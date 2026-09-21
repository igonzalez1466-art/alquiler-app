import { readDepositClaim, claimSettlement } from "@/app/lib/depositClaim";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import {
  canStartAutomaticDepositRelease,
  getDepositDecisionDeadline,
} from "@/app/lib/depositAutoReleasePolicy";

export type SettlementDecision = {
  kind: "full" | "partial" | "retain";
  refundCents: number;
  retainedCents: number;
  reason: string | null;
  reasonCode: string | null;
  destination: string;
  paymentIntent: string;
  ownerCents: number;
  source?: "owner" | "automatic" | "claim";
  decidedAt?: string;
};

/* ============================================================
   DECISIÓN MANUAL DEL PROPIETARIO
============================================================ */

export async function lockSettlementDecision(
  id: string,
  decision: SettlementDecision
) {
  return prisma.$transaction(async (tx) => {
    // Comparte el bloqueo con la decisión automática.
    await tx.$queryRaw`
      SELECT "id"
      FROM "Booking"
      WHERE "id" = ${id}
      FOR UPDATE
    `;

    const booking = await tx.booking.findUniqueOrThrow({
      where: { id },
    });

    if (booking.settlementLegacyReview) {
      throw new Error(
        "Wymagana weryfikacja wcześniejszych operacji Stripe przed rozliczeniem."
      );
    }

    const saved =
      booking.settlementDecision as SettlementDecision | null;

    if (saved?.source === "automatic") {
      throw new Error(
        "Automatyczny zwrot kaucji został już rozpoczęty. Nie można zmienić decyzji."
      );
    }

    // Conserva las decisiones manuales ya guardadas.
    // Pueden reintentarse después del vencimiento,
    // pero sin cambiar importes ni motivos.
    if (saved) {
      const sameDecision =
        saved.kind === decision.kind &&
        saved.refundCents === decision.refundCents &&
        saved.retainedCents === decision.retainedCents &&
        saved.reason === decision.reason &&
        saved.reasonCode === decision.reasonCode &&
        saved.destination === decision.destination &&
        saved.paymentIntent === decision.paymentIntent &&
        saved.ownerCents === decision.ownerCents;

      if (!sameDecision) {
        throw new Error(
          "Rozliczenie już rozpoczęte. Ponów tę samą decyzję, kwotę i powód."
        );
      }

      return saved;
    }

    const claim = readDepositClaim(booking.depositClaim);
    if (booking.depositClaim !== null) {
      if (!claim || claim.status !== "APPROVED") throw new Error("Kaucja jest zablokowana do rozstrzygnięcia roszczenia.");
      const agreed = claimSettlement(claim, booking.depositCents ?? 0);
      if (decision.kind !== agreed.kind || decision.refundCents !== agreed.refundCents || decision.retainedCents !== agreed.retainedCents || decision.reason !== agreed.reason || decision.reasonCode !== agreed.reasonCode) {
        throw new Error("Kwota i powód muszą odpowiadać zatwierdzonej decyzji.");
      }
    } else if (decision.kind !== "full") {
      throw new Error("Potrącenie wymaga zgody najemcy lub decyzji obsługi.");
    }

    if (
      booking.settlementCompletedAt ||
      booking.depositStatus !== "PAID" ||
      booking.depositDecisionAt
    ) {
      throw new Error(
        "Decyzja dotycząca kaucji została już podjęta."
      );
    }

    if (
      booking.cancelledAt ||
      booking.paymentStatus !== "PAID" ||
      (
        booking.returnConfirmationStatus !== "CONFIRMED" &&
        booking.returnConfirmationStatus !== "AUTO_CONFIRMED"
      )
    ) {
      throw new Error(
        "Nie można rozliczyć kaucji w aktualnym stanie rezerwacji."
      );
    }

    const deadline = getDepositDecisionDeadline(
      booking.returnConfirmedAt
    );

    if (!claim && deadline && deadline <= new Date()) {
      throw new Error(
        "Termin decyzji dotyczącej kaucji upłynął. Jeśli nie ma zgłoszonego problemu, kaucja podlega automatycznemu zwrotowi."
      );
    }

    const manualDecision: SettlementDecision = {
      ...decision,
      source: claim ? "claim" : "owner",
      decidedAt: new Date().toISOString(),
    };

    await tx.booking.update({
      where: { id },
      data: {
        settlementDecision:
          manualDecision as Prisma.InputJsonValue,
      },
    });

    return manualDecision;
  });
}

/* ============================================================
   OPERACIONES STRIPE Y REINTENTOS
============================================================ */

type OperationParams =
  | Stripe.TransferCreateParams
  | Stripe.RefundCreateParams;

export async function settlementOperation(
  stripe: Stripe,
  bookingId: string,
  kind: "rent" | "refund" | "compensation",
  params: OperationParams
) {
  let op = await prisma.settlementOperation.upsert({
    where: {
      bookingId_kind: {
        bookingId,
        kind,
      },
    },
    create: {
      bookingId,
      kind,
      params: params as Prisma.InputJsonValue,
    },
    update: {},
  });

  if (op.stripeId) {
    return {
      id: op.stripeId,
      amount: op.amount!,
    };
  }

  // Solo un rechazo definitivo por falta de saldo
  // permite iniciar un nuevo intento de transferencia.
  if (op.status === "RETRYABLE") {
    await prisma.settlementOperation.updateMany({
      where: {
        id: op.id,
        attempt: op.attempt,
        status: "RETRYABLE",
      },
      data: {
        attempt: {
          increment: 1,
        },
        status: "READY",
        startedAt: null,
        lastErrorCode: null,
      },
    });

    op = await prisma.settlementOperation.findUniqueOrThrow({
      where: {
        id: op.id,
      },
    });
  }

  if (op.stripeId) {
    return {
      id: op.stripeId,
      amount: op.amount!,
    };
  }

  if (!op.startedAt) {
    await prisma.settlementOperation.updateMany({
      where: {
        id: op.id,
        attempt: op.attempt,
        startedAt: null,
      },
      data: {
        startedAt: new Date(),
        status: "IN_FLIGHT",
      },
    });

    op = await prisma.settlementOperation.findUniqueOrThrow({
      where: {
        id: op.id,
      },
    });
  }

  if (op.stripeId) {
    return {
      id: op.stripeId,
      amount: op.amount!,
    };
  }

  // No repetir automáticamente intentos antiguos
  // cuyo resultado en Stripe sea incierto.
  if (
    !op.startedAt ||
    Date.now() - op.startedAt.getTime() >=
      23 * 60 * 60 * 1000
  ) {
    throw new Error(
      "Wymagana weryfikacja operacji w Stripe. Automatyczne ponowienie zablokowane."
    );
  }

  const options = {
    idempotencyKey: `settlement-${op.id}-${op.attempt}`,
    maxNetworkRetries: 0,
  };

  let result: Stripe.Transfer | Stripe.Refund;

  try {
    result =
      kind === "refund"
        ? await stripe.refunds.create(
            op.params as unknown as Stripe.RefundCreateParams,
            options
          )
        : await stripe.transfers.create(
            op.params as unknown as Stripe.TransferCreateParams,
            options
          );
  } catch (error) {
    // No cambiar de clave por timeout, error 5xx,
    // conflicto, límite de peticiones o error de base de datos.
    const rejected =
      kind !== "refund" &&
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "balance_insufficient" &&
      error.statusCode === 400;

    await prisma.settlementOperation.updateMany({
      where: {
        id: op.id,
        attempt: op.attempt,
        stripeId: null,
      },
      data: {
        status: rejected ? "RETRYABLE" : "IN_FLIGHT",
        lastErrorCode:
          error instanceof Stripe.errors.StripeError
            ? error.code ?? error.type
            : "unknown",
      },
    });

    throw new Error(
      rejected
        ? "Brak środków na transfer. Uzupełnij saldo Stripe i ponów tę samą decyzję."
        : "Nie potwierdzono operacji Stripe. Ponów tę samą decyzję; nie zmieniaj kwoty."
    );
  }

  // Fuera del catch de Stripe: un fallo al guardar
  // no debe permitir crear un nuevo intento.
  await prisma.settlementOperation.updateMany({
    where: {
      id: op.id,
      attempt: op.attempt,
    },
    data: {
      stripeId: result.id,
      amount: result.amount,
      status: "SUCCEEDED",
      lastErrorCode: null,
    },
  });

  return {
    id: result.id,
    amount: result.amount,
  };
}

/* ============================================================
   FINALIZAR LIQUIDACIÓN
============================================================ */

export async function finishSettlement(
  id: string,
  data: Prisma.BookingUpdateInput
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "public"."Booking"
      WHERE "id" = ${id}
      FOR UPDATE
    `;

    const current = await tx.booking.findUniqueOrThrow({
      where: { id },
    });

    if (current.settlementCompletedAt) {
      return false;
    }

    await tx.booking.update({
      where: { id },
      data: {
        ...data,

        // El webhook puede haber confirmado ya el reembolso.
        ...(
          current.depositStatus === "REFUNDED" ||
          current.depositStatus === "PARTIALLY_REFUNDED"
            ? {
                depositStatus: current.depositStatus,
              }
            : {}
        ),

        settlementCompletedAt: new Date(),
      },
    });

    return true;
  });
}

/* ============================================================
   DECISIÓN AUTOMÁTICA TRAS 48 HORAS
============================================================ */

export async function lockAutomaticSettlementDecision(
  bookingId: string,
  destination: string
): Promise<SettlementDecision | null> {
  if (!destination) {
    throw new Error(
      "Brak konta Stripe właściciela."
    );
  }

  return prisma.$transaction(async (tx) => {
    // Comprueba y guarda la decisión bajo el mismo bloqueo
    // utilizado por las decisiones manuales.
    await tx.$queryRaw`
      SELECT "id"
      FROM "Booking"
      WHERE "id" = ${bookingId}
      FOR UPDATE
    `;

    const booking = await tx.booking.findUnique({
      where: {
        id: bookingId,
      },
    });

    if (!booking) {
      return null;
    }

    const now = new Date();

    if (!canStartAutomaticDepositRelease(booking, now)) {
      return null;
    }

    const owner = await tx.user.findUnique({
      where: {
        id: booking.ownerId,
      },
      select: {
        stripeAccountId: true,
      },
    });

    if (owner?.stripeAccountId !== destination) {
      throw new Error(
        "Konto wypłat właściciela uległo zmianie. Spróbuj ponownie."
      );
    }

    const {
      rentAmountCents,
      platformFeeCents,
      ownerPayoutCents,
      depositCents,
      depositPaymentIntentId,
    } = booking;

    if (
      rentAmountCents == null ||
      platformFeeCents == null ||
      ownerPayoutCents == null ||
      depositCents == null ||
      !depositPaymentIntentId
    ) {
      throw new Error(
        "Brak kompletnego snapshotu ekonomicznego rezerwacji."
      );
    }

    if (
      !Number.isSafeInteger(rentAmountCents) ||
      !Number.isSafeInteger(platformFeeCents) ||
      !Number.isSafeInteger(ownerPayoutCents) ||
      !Number.isSafeInteger(depositCents) ||
      rentAmountCents <= 0 ||
      platformFeeCents < 0 ||
      ownerPayoutCents <= 0 ||
      depositCents <= 0 ||
      rentAmountCents !==
        platformFeeCents + ownerPayoutCents
    ) {
      throw new Error(
        "Nieprawidłowy snapshot ekonomiczny rezerwacji."
      );
    }

    // Una operación previa sin decisión asociada
    // necesita revisión antes de iniciar otra.
    const previousOperation =
      await tx.settlementOperation.findFirst({
        where: {
          bookingId,
        },
        select: {
          id: true,
        },
      });

    if (previousOperation) {
      throw new Error(
        "Istnieją wcześniejsze operacje rozliczenia. Wymagana weryfikacja."
      );
    }

    const decision: SettlementDecision = {
      kind: "full",
      refundCents: depositCents,
      retainedCents: 0,
      reason: null,
      reasonCode: null,
      destination,
      paymentIntent: depositPaymentIntentId,
      ownerCents: ownerPayoutCents,
      source: "automatic",
      decidedAt: now.toISOString(),
    };

    const saved = await tx.booking.updateMany({
      where: {
        id: bookingId,
        settlementDecision: {
          equals: Prisma.DbNull,
        },
        settlementCompletedAt: null,
        settlementLegacyReview: false,
        depositStatus: "PAID",
        depositDecisionAt: null,
      },
      data: {
        settlementDecision:
          decision as Prisma.InputJsonValue,
      },
    });

    return saved.count === 1 ? decision : null;
  });
}