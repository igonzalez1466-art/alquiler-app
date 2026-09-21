import type { Booking } from "@prisma/client";

export const DEPOSIT_DECISION_WINDOW_MS =
  48 * 60 * 60 * 1000;

export function getDepositDecisionDeadline(
  returnConfirmedAt: Date | null
): Date | null {
  if (!returnConfirmedAt) {
    return null;
  }

  return new Date(
    returnConfirmedAt.getTime() +
      DEPOSIT_DECISION_WINDOW_MS
  );
}

// Comprueba si puede iniciarse una NUEVA decisión automática.
// Los reintentos de decisiones ya guardadas se gestionan aparte.
export function canStartAutomaticDepositRelease(
  booking: Booking,
  now: Date = new Date()
): boolean {
  if (
    booking.status !== "CONFIRMED" &&
    booking.status !== "PAID"
  ) {
    return false;
  }

  if (
    booking.paymentStatus !== "PAID" ||
    !booking.paidAt ||
    booking.cancelledAt
  ) {
    return false;
  }

  if (
    booking.returnStatus !== "DELIVERED" ||
    (
      booking.returnConfirmationStatus !== "CONFIRMED" &&
      booking.returnConfirmationStatus !== "AUTO_CONFIRMED"
    )
  ) {
    return false;
  }

  const deadline = getDepositDecisionDeadline(
    booking.returnConfirmedAt
  );

  if (
    !deadline ||
    !Number.isFinite(deadline.getTime()) ||
    deadline > now
  ) {
    return false;
  }

  // No iniciar devoluciones automáticas con incidencias.
  if (
    booking.depositClaim != null ||
    booking.damageClaimStatus !== "NONE" ||
    booking.deliveryConfirmationStatus === "DISPUTED"
  ) {
    return false;
  }

  if (
    booking.depositStatus !== "PAID" ||
    booking.depositCents == null ||
    booking.depositCents <= 0 ||
    !booking.depositPaymentIntentId
  ) {
    return false;
  }

  // Respetar decisiones manuales y liquidaciones anteriores.
  if (
    booking.settlementDecision !== null ||
    booking.settlementCompletedAt ||
    booking.settlementLegacyReview ||
    booking.depositDecisionAt ||
    booking.depositDecisionById ||
    booking.depositRetentionReason ||
    booking.depositRetentionReasonCode
  ) {
    return false;
  }

  // No iniciar otra devolución si existen movimientos previos.
  if (
    booking.depositRefundId ||
    booking.depositRefundedAt ||
    booking.depositTransferId ||
    (booking.depositRefundedCents ?? 0) !== 0 ||
    (booking.depositRetainedCents ?? 0) !== 0 ||
    (booking.depositTransferredCents ?? 0) !== 0
  ) {
    return false;
  }

  return true;
}