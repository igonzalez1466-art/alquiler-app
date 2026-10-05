import { queueIncidentEmail, sendPendingIncidentEmails } from "@/app/lib/incidentNotification";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { readIssue } from "@/app/lib/logisticsIssue";
import { settlementOperation } from "@/app/lib/settlement";
import { rentalAmounts } from "@/app/lib/incidentPolicy";

type RentDecision = { refund: number; payout: number; fee: number; paymentIntent: string; destination: string | null; incidentId: string | null };

/** Freeze finances under the same row lock used by receipt and incident reporting. */
export async function settleRentOnlyBooking(bookingId: string) {
  const decision = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
    const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { owner: { select: { stripeAccountId: true } } } });
    if (b.settlementCompletedAt) return null;
    if (b.cancelledAt || b.status === "CANCELLED" || b.paymentStatus !== "PAID" || !b.paymentRef) throw new Error("Rezerwacja nie jest gotowa do rozliczenia.");
    if ((b.depositCents ?? 0) !== 0 || b.depositStatus !== "NONE" || b.depositClaim !== null || b.settlementLegacyReview || b.settlementDecision) throw new Error("Historyczne rozliczenie wymaga osobnej weryfikacji.");
    if (b.rentSettlement) return b.rentSettlement as unknown as RentDecision;
    const incident = await tx.incident.findUnique({ where: { bookingId_stage: { bookingId, stage: "DELIVERY" } } });
    if (incident && !["AGREEMENT_REACHED", "RESOLVED"].includes(incident.status)) throw new Error("Wypłata wstrzymana do uzgodnienia rozwiązania dostawy.");
    if (!incident && (!b.deliveryConfirmedAt || !["CONFIRMED", "AUTO_CONFIRMED"].includes(b.deliveryConfirmationStatus) || b.deliveryIssue !== null && !readIssue(b.deliveryIssue)?.resolvedAt)) throw new Error("Najpierw potwierdź odbiór lub uzgodnij rozwiązanie dostawy.");
    if (incident && (!incident.acceptedAt || incident.refundCents === null)) throw new Error("Brak zgodnego rozwiązania obu stron.");
    const amounts = rentalAmounts(b.rentAmountCents ?? 0, b.platformFeeCents ?? -1, b.ownerPayoutCents ?? -1, incident?.refundCents ?? 0);
    const saved: RentDecision = { ...amounts, paymentIntent: b.paymentRef, destination: b.owner.stripeAccountId, incidentId: incident?.id ?? null };
    if (await tx.settlementOperation.findFirst({ where: { bookingId, kind: { in: ["rent", "refund", "compensation"] } } })) throw new Error("Wcześniejsza operacja wymaga weryfikacji.");
    await tx.booking.update({ where: { id: bookingId }, data: { rentSettlement: saved as unknown as Prisma.InputJsonValue } });
    return saved;
  });
  if (!decision) return false;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Konfiguracja płatności niedostępna.");
  const stripe = new Stripe(secret, { apiVersion: "2025-09-30.clover", timeout: 10000, maxNetworkRetries: 0 });
  const pi = await stripe.paymentIntents.retrieve(decision.paymentIntent, { expand: ["latest_charge"] });
  const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const charge = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  if (pi.status !== "succeeded" || pi.currency !== "pln" || pi.amount !== b.rentAmountCents || pi.metadata.bookingId !== bookingId || !charge || charge.disputed || pi.transfer_data) throw new Error("Płatność wymaga weryfikacji.");
  if (charge.amount_refunded > 0) {
    const prior = await prisma.settlementOperation.findUnique({ where: { bookingId_kind: { bookingId, kind: "refund" } } });
    if (!prior?.stripeId || prior.amount !== decision.refund || charge.amount_refunded !== decision.refund) throw new Error("Zewnętrzny zwrot wymaga weryfikacji.");
  }
  let refundId: string | null = null;
  if (decision.refund > 0) {
    const operation = await settlementOperation(stripe, bookingId, "refund", { payment_intent: decision.paymentIntent, amount: decision.refund, metadata: { bookingId, incidentId: decision.incidentId!, type: "rental_agreed_refund" } });
    refundId = operation.id;
    const refund = await stripe.refunds.retrieve(refundId);
    if (refund.status !== "succeeded" || refund.amount !== decision.refund) throw new Error("Zwrot oczekuje na potwierdzenie Stripe lub wymaga wyjaśnienia. Wypłata nadal wstrzymana.");
  }
  const refreshedCharge = await stripe.charges.retrieve(charge.id);
  if (refreshedCharge.disputed || refreshedCharge.amount_refunded !== decision.refund) throw new Error("Dodatkowy zwrot w Stripe wymaga weryfikacji.");
  let transferId: string | null = null;
  if (decision.payout > 0) {
    if (!decision.destination) {
      const owner = await prisma.user.findUniqueOrThrow({ where: { id: b.ownerId } });
      if (!owner.stripeAccountId) throw new Error("Właściciel musi skonfigurować konto wypłat.");
      decision.destination = owner.stripeAccountId;
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
        const current = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        const saved = current.rentSettlement as unknown as RentDecision;
        if (saved.destination) decision.destination = saved.destination;
        else await tx.booking.update({ where: { id: bookingId }, data: { rentSettlement: decision as unknown as Prisma.InputJsonValue } });
      });
    }
    const account = await stripe.accounts.retrieve(decision.destination!);
    if (!account.details_submitted || !account.payouts_enabled || account.capabilities?.transfers !== "active") throw new Error("Konto wypłat właściciela nie jest aktywne.");
    const transfer = await settlementOperation(stripe, bookingId, "rent", { amount: decision.payout, currency: "pln", destination: decision.destination!, source_transaction: charge.id, metadata: { bookingId, type: "rental_owner_payout" } });
    if (transfer.amount !== decision.payout) throw new Error("Nieprawidłowa kwota transferu.");
    transferId = transfer.id;
  }
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
    await tx.booking.update({ where: { id: bookingId }, data: {
      ownerTransferId: transferId, ownerTransferCents: decision.payout, ownerTransferredAt: transferId ? new Date() : null,
      rentRefundedCents: decision.refund, refundedAt: refundId ? new Date() : null, settlementCompletedAt: new Date(),
      ...(decision.refund === b.rentAmountCents ? { paymentStatus: "REFUNDED", status: "CANCELLED", cancelledAt: new Date() } : {}),
      ...(decision.incidentId && decision.refund < (b.rentAmountCents ?? 0) ? { shippingStatus: "DELIVERED", deliveryConfirmationStatus: "CONFIRMED", deliveryConfirmedAt: new Date(), deliveryConfirmedBy: "RENTER" } : {}),
      ...(decision.incidentId && b.deliveryIssue && typeof b.deliveryIssue === "object" && !Array.isArray(b.deliveryIssue) ? { deliveryIssue: { ...b.deliveryIssue, resolvedAt: new Date().toISOString(), resolvedById: b.renterId } } : {}),
    } });
    if (decision.incidentId) {
      const incident = await tx.incident.update({ where: { id: decision.incidentId }, data: { status: "RESOLVED", resolvedAt: new Date(), refundId } });
      await queueIncidentEmail(tx, incident, "resolved", null, `resolved:${incident.id}`);
    }
  });
  await sendPendingIncidentEmails(bookingId);
  return true;
}
export async function trySettleRentOnlyBooking(bookingId: string) {
  try { await settleRentOnlyBooking(bookingId); }
  catch (error) { console.error("[RENT PAYOUT] Reservation requires retry", bookingId, error); }
}
