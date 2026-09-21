import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";
import { tryInviteBookingReview } from "@/app/lib/reviewInvitations";
import {
  canStartAutomaticDepositRelease,
} from "@/app/lib/depositAutoReleasePolicy";
import {
  lockAutomaticSettlementDecision,
  settlementOperation,
  finishSettlement,
  type SettlementDecision,
} from "@/app/lib/settlement";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("Brak STRIPE_SECRET_KEY.");
  }

  return new Stripe(key, {
    apiVersion: "2025-09-30.clover",
    timeout: 10000,
    maxNetworkRetries: 0,
  });
}

function readAutomaticDecision(
  value: unknown
): SettlementDecision | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const decision = value as Partial<SettlementDecision>;

  if (
    decision.source !== "automatic" ||
    decision.kind !== "full" ||
    typeof decision.refundCents !== "number" ||
    !Number.isSafeInteger(decision.refundCents) ||
    decision.refundCents <= 0 ||
    decision.retainedCents !== 0 ||
    typeof decision.ownerCents !== "number" ||
    !Number.isSafeInteger(decision.ownerCents) ||
    decision.ownerCents <= 0 ||
    typeof decision.destination !== "string" ||
    !decision.destination ||
    typeof decision.paymentIntent !== "string" ||
    !decision.paymentIntent ||
    decision.reason !== null ||
    decision.reasonCode !== null
  ) {
    return null;
  }

  return decision as SettlementDecision;
}

export type AutomaticDepositReleaseResult = {
  bookingId: string;
  completed: boolean;
  outcome:
    | "not_eligible"
    | "already_completed"
    | "decision_already_exists"
    | "completed";
};

export async function releaseDepositAutomatically(
  bookingId: string
): Promise<AutomaticDepositReleaseResult> {
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
  });

  if (!booking) {
    return {
      bookingId,
      completed: false,
      outcome: "not_eligible",
    };
  }

  if (booking.settlementCompletedAt) {
    return {
      bookingId,
      completed: false,
      outcome: "already_completed",
    };
  }

  let decision = readAutomaticDecision(
    booking.settlementDecision
  );

  // Nunca sustituir ni ejecutar una decisión manual.
  if (booking.settlementDecision !== null && !decision) {
    return {
      bookingId,
      completed: false,
      outcome: "decision_already_exists",
    };
  }

  if (!decision && !canStartAutomaticDepositRelease(booking)) {
    return {
      bookingId,
      completed: false,
      outcome: "not_eligible",
    };
  }

  const stripe = getStripe();

  if (!decision) {
    const owner = await prisma.user.findUnique({
      where: {
        id: booking.ownerId,
      },
      select: {
        stripeAccountId: true,
      },
    });

    if (!owner?.stripeAccountId) {
      throw new Error(
        "Właściciel nie ma skonfigurowanego konta wypłat."
      );
    }

    const account = await stripe.accounts.retrieve(
      owner.stripeAccountId
    );

    if (
      account.details_submitted !== true ||
      account.payouts_enabled !== true ||
      account.capabilities?.transfers !== "active"
    ) {
      throw new Error(
        "Konto wypłat właściciela nie jest aktywne."
      );
    }

    decision = await lockAutomaticSettlementDecision(
      bookingId,
      owner.stripeAccountId
    );

    if (!decision) {
      return {
        bookingId,
        completed: false,
        outcome: "not_eligible",
      };
    }
  }

  // Releer después de guardar la decisión, también en reintentos.
  const current = await prisma.booking.findUniqueOrThrow({
    where: {
      id: bookingId,
    },
  });

  if (current.settlementCompletedAt) {
    return {
      bookingId,
      completed: false,
      outcome: "already_completed",
    };
  }

  const saved = readAutomaticDecision(
    current.settlementDecision
  );

  if (!saved) {
    throw new Error(
      "Brak prawidłowej automatycznej decyzji rozliczenia."
    );
  }

  if (
    current.settlementLegacyReview ||
    current.cancelledAt ||
    current.paymentStatus !== "PAID" ||
    (
      current.status !== "CONFIRMED" &&
      current.status !== "PAID"
    ) ||
    current.returnStatus !== "DELIVERED" ||
    (
      current.returnConfirmationStatus !== "CONFIRMED" &&
      current.returnConfirmationStatus !== "AUTO_CONFIRMED"
    ) ||
    current.damageClaimStatus !== "NONE" ||
    current.deliveryConfirmationStatus === "DISPUTED" ||
    current.depositStatus === "FAILED" ||
    current.depositStatus === "RETAINED" ||
    current.depositStatus === "PARTIALLY_REFUNDED"
  ) {
    throw new Error(
      "Rozliczenie wymaga weryfikacji aktualnego stanu rezerwacji."
    );
  }

  if (
    saved.refundCents !== current.depositCents ||
    saved.paymentIntent !== current.depositPaymentIntentId ||
    saved.ownerCents !== current.ownerPayoutCents
  ) {
    throw new Error(
      "Dane rezerwacji nie zgadzają się z zapisaną decyzją."
    );
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(
    saved.paymentIntent,
    {
      expand: ["latest_charge"],
    }
  );

  if (
    paymentIntent.status !== "succeeded" ||
    paymentIntent.currency !== "pln"
  ) {
    throw new Error(
      "Brak potwierdzonej płatności w PLN."
    );
  }

  const charge = paymentIntent.latest_charge;

  if (
    !charge ||
    typeof charge === "string" ||
    charge.disputed
  ) {
    throw new Error(
      "Nie można potwierdzić płatności bez sporu."
    );
  }

  // Alquiler: reutiliza la transferencia ya registrada,
  // si existe, y comprueba sus datos.
  let ownerTransfer: {
    id: string;
    amount: number;
  };

  if (current.ownerTransferId) {
    const existingTransfer = await stripe.transfers.retrieve(
      current.ownerTransferId
    );

    const destination =
      typeof existingTransfer.destination === "string"
        ? existingTransfer.destination
        : existingTransfer.destination?.id;

    if (
      existingTransfer.amount !== saved.ownerCents ||
      existingTransfer.currency !== "pln" ||
      destination !== saved.destination ||
      existingTransfer.amount_reversed !== 0
    ) {
      throw new Error(
        "Wcześniejszy transfer wymaga weryfikacji."
      );
    }

    ownerTransfer = {
      id: existingTransfer.id,
      amount: existingTransfer.amount,
    };
  } else {
    ownerTransfer = await settlementOperation(
      stripe,
      bookingId,
      "rent",
      {
        amount: saved.ownerCents,
        currency: "pln",
        destination: saved.destination,
        metadata: {
          bookingId,
          bookingNumber: String(current.bookingNumber),
          type: "rental_owner_payout",
        },
      }
    );
  }

  // Fianza: utiliza la misma operación persistente
  // en todos los reintentos.
  const refundOperation = current.depositRefundId
    ? { id: current.depositRefundId }
    : await settlementOperation(
        stripe,
        bookingId,
        "refund",
        {
          amount: saved.refundCents,
          payment_intent: saved.paymentIntent,
          metadata: {
            bookingId,
            type: "deposit_refund",
          },
        }
      );

  const refund = await stripe.refunds.retrieve(
    refundOperation.id
  );

  const refundPaymentIntent =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent?.id;

  if (
    refund.amount !== saved.refundCents ||
    refund.currency !== "pln" ||
    refundPaymentIntent !== saved.paymentIntent
  ) {
    throw new Error(
      "Zwrot Stripe nie zgadza się z zapisaną decyzją."
    );
  }

  // No marcar como completada una devolución fallida
  // ni crear otra automáticamente para reemplazarla.
  if (
    refund.status !== "succeeded" &&
    refund.status !== "pending"
  ) {
    throw new Error(
      "Zwrot Stripe wymaga weryfikacji. Nie utworzono kolejnego zwrotu."
    );
  }

  const completed = await finishSettlement(bookingId, {
    depositStatus:
      refund.status === "succeeded"
        ? "REFUNDED"
        : "REFUND_PENDING",

    depositRefundId: refund.id,
    depositRefundedCents: saved.refundCents,
    depositRetainedCents: 0,

    ...(refund.status === "succeeded"
      ? {
          depositRefundedAt:
            current.depositRefundedAt ?? new Date(),
        }
      : {}),

    depositDecisionAt: new Date(),
    // La decisión es del sistema, no del propietario.
    depositDecisionById: null,
    depositRetentionReason: null,
    depositRetentionReasonCode: null,
    depositLastError: null,

    ownerTransferId: ownerTransfer.id,
    ownerTransferCents: ownerTransfer.amount,
    ownerTransferredAt:
      current.ownerTransferredAt ?? new Date(),

    depositTransferId: null,
    depositTransferredCents: null,
    depositTransferredAt: null,
  });

  await tryInviteBookingReview(bookingId);

  return {
    bookingId,
    completed,
    outcome: completed
      ? "completed"
      : "already_completed",
  };
}