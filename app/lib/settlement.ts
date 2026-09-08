import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";

export type SettlementDecision = {
  kind: "full" | "partial" | "retain";
  refundCents: number;
  retainedCents: number;
  reason: string | null;
  reasonCode: string | null;
  destination: string;
  paymentIntent: string;
  ownerCents: number;
};

// Commit the economic decision BEFORE any external side effect. A competing
// action must use exactly the same decision, including the partial refund reason.
export async function lockSettlementDecision(id: string, decision: SettlementDecision) {
  await prisma.booking.updateMany({
    where: { id, settlementDecision: { equals: Prisma.DbNull },
      settlementLegacyReview: false, depositStatus: "PAID", depositDecisionAt: null },
    data: { settlementDecision: decision },
  });
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id } });
  if (booking.settlementLegacyReview) {
    throw new Error("Wymagana weryfikacja wcześniejszych operacji Stripe przed rozliczeniem.");
  }
  const saved = booking.settlementDecision as SettlementDecision | null;
  if (!saved || Object.keys(decision).some(key =>
    saved[key as keyof SettlementDecision] !== decision[key as keyof SettlementDecision])) {
    throw new Error("Rozliczenie już rozpoczęte. Ponów tę samą decyzję, kwotę i powód.");
  }
  return saved;
}

type OperationParams = Stripe.TransferCreateParams | Stripe.RefundCreateParams;

export async function settlementOperation(
  stripe: Stripe, bookingId: string, kind: "rent" | "refund" | "compensation",
  params: OperationParams,
) {
  let op = await prisma.settlementOperation.upsert({
    where: { bookingId_kind: { bookingId, kind } },
    create: { bookingId, kind, params: params as Prisma.InputJsonValue },
    update: {},
  });
  if (op.stripeId) return { id: op.stripeId, amount: op.amount! };

  // Only a definitive transfer rejection may advance the durable attempt.
  // CAS prevents two callers from allocating different retry keys.
  if (op.status === "RETRYABLE") {
    await prisma.settlementOperation.updateMany({
      where: { id: op.id, attempt: op.attempt, status: "RETRYABLE" },
      data: { attempt: { increment: 1 }, status: "READY", startedAt: null, lastErrorCode: null },
    });
    op = await prisma.settlementOperation.findUniqueOrThrow({ where: { id: op.id } });
  }
  if (op.stripeId) return { id: op.stripeId, amount: op.amount! };
  if (!op.startedAt) {
    await prisma.settlementOperation.updateMany({
      where: { id: op.id, attempt: op.attempt, startedAt: null },
      data: { startedAt: new Date(), status: "IN_FLIGHT" },
    });
    op = await prisma.settlementOperation.findUniqueOrThrow({ where: { id: op.id } });
  }
  if (op.stripeId) return { id: op.stripeId, amount: op.amount! };
  // Stripe may prune keys after 24 hours. Never replay an uncertain old attempt.
  // Reconciliation must attach the verified Stripe object; absence is NOT proof
  // of failure and must never automatically authorize another payment.
  if (!op.startedAt || Date.now() - op.startedAt.getTime() >= 23 * 60 * 60 * 1000) {
    throw new Error("Wymagana weryfikacja operacji w Stripe. Automatyczne ponowienie zablokowane.");
  }
  const options = { idempotencyKey: `settlement-${op.id}-${op.attempt}`, maxNetworkRetries: 0 };
  let result: Stripe.Transfer | Stripe.Refund;
  try {
    result = kind === "refund"
      ? await stripe.refunds.create(op.params as unknown as Stripe.RefundCreateParams, options)
      : await stripe.transfers.create(op.params as unknown as Stripe.TransferCreateParams, options);
  } catch (error) {
    // No rotation on timeout, 5xx, 409, rate limiting, or Prisma failures.
    const rejected = kind !== "refund" && error instanceof Stripe.errors.StripeInvalidRequestError
      && error.code === "balance_insufficient" && error.statusCode === 400;
    await prisma.settlementOperation.updateMany({
      where: { id: op.id, attempt: op.attempt, stripeId: null },
      data: { status: rejected ? "RETRYABLE" : "IN_FLIGHT",
        lastErrorCode: error instanceof Stripe.errors.StripeError ? error.code ?? error.type : "unknown" },
    });
    throw new Error(rejected
      ? "Brak środków na transfer. Uzupełnij saldo Stripe i ponów tę samą decyzję."
      : "Nie potwierdzono operacji Stripe. Ponów tę samą decyzję; nie zmieniaj kwoty.");
  }
  // Deliberately outside the Stripe catch: a database failure must NEVER rotate.
  await prisma.settlementOperation.updateMany({
    where: { id: op.id, attempt: op.attempt },
    data: { stripeId: result.id, amount: result.amount, status: "SUCCEEDED", lastErrorCode: null },
  });
  return { id: result.id, amount: result.amount };
}

export async function finishSettlement(id: string, data: Prisma.BookingUpdateInput) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "public"."Booking" WHERE "id" = ${id} FOR UPDATE`;
    const current = await tx.booking.findUniqueOrThrow({ where: { id } });
    if (current.settlementCompletedAt) return false;
    await tx.booking.update({ where: { id }, data: {
      ...data,
      // A fast webhook may already have confirmed the refund.
      ...(current.depositStatus === "REFUNDED" || current.depositStatus === "PARTIALLY_REFUNDED"
        ? { depositStatus: current.depositStatus } : {}),
      settlementCompletedAt: new Date(),
    } });
    return true;
  });
}
