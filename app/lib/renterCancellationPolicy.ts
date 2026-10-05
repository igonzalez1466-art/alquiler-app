export const RENTER_CANCELLATION_NOTICE_MS = 7 * 24 * 60 * 60 * 1000;
export function renterCancellationDeadline(startDate: Date) {
  return new Date(startDate.getTime() - RENTER_CANCELLATION_NOTICE_MS);
}
type Booking = { renterId: string; startDate: Date; status: string; cancelledAt: Date | null; paymentStatus: string;
  depositCents: number | null; depositStatus: string; deliveryConfirmedAt: Date | null; deliveryConfirmationStatus: string;
  ownerTransferId: string | null; settlementCompletedAt: Date | null; rentSettlement: unknown; settlementDecision: unknown };
export function canRenterCancelBooking(b: Booking, userId: string, now = new Date()) {
  return b.renterId === userId && ["PENDING", "AWAITING_PAYMENT", "CONFIRMED"].includes(b.status) && !b.cancelledAt &&
    ["PENDING", "AUTHORIZED", "PAID", "FAILED"].includes(b.paymentStatus) && now <= renterCancellationDeadline(b.startDate) &&
    b.depositCents === 0 && b.depositStatus === "NONE" && !b.deliveryConfirmedAt &&
    !["CONFIRMED", "AUTO_CONFIRMED"].includes(b.deliveryConfirmationStatus) && !b.ownerTransferId &&
    !b.settlementCompletedAt && !b.rentSettlement && !b.settlementDecision;
}
export type RenterCancellation = {
  requestedAt: string; requestedById: string; amountCents: number; paymentIntent: string | null;
  status: "NONE" | "PENDING" | "SUCCEEDED" | "FAILED"; refundId: string | null; lastError: string | null;
  notifications: Record<"owner" | "renter", { sentAt: string | null; leaseUntil: string | null }>;
};
export function readRenterCancellation(value: unknown): RenterCancellation | null {
  if (!value || typeof value !== "object" || !("requestedById" in value) || !("amountCents" in value) ||
    typeof value.requestedById !== "string" || !Number.isSafeInteger(value.amountCents) || Number(value.amountCents) < 0) return null;
  return value as RenterCancellation;
}
