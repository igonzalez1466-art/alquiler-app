import type { Prisma } from "@prisma/client";
type BookingState = {
  status: string; paymentStatus: string; depositCents?: number | null; settlementCompletedAt?: Date | null;
  incidents?: { stage: string; status: string; acceptedAt?: Date | string | null; refundCents?: number | null }[];
};
export function canReturnCancelledIncidentBooking(b: BookingState): boolean {
  return b.status === "CANCELLED" && b.paymentStatus === "REFUNDED" && b.depositCents === 0 && !!b.settlementCompletedAt &&
    !!b.incidents?.some(i => i.stage === "DELIVERY" && i.status === "RESOLVED" && !!i.acceptedAt && (i.refundCents ?? 0) > 0);
}
export function cancelledIncidentReturnWhere(): Prisma.BookingWhereInput {
  return { status: "CANCELLED", paymentStatus: "REFUNDED", depositCents: 0, settlementCompletedAt: { not: null },
    incidents: { some: { stage: "DELIVERY", status: "RESOLVED", acceptedAt: { not: null }, refundCents: { gt: 0 } } } };
}
