import type { Prisma } from "@prisma/client";
import { canReturnCancelledIncidentBooking } from "@/app/lib/cancelledIncidentReturn";
import { missingDelivery } from "@/app/lib/incidentPolicy";
import { getApprovalDeadline } from "@/app/lib/approvalExpiry";
import { isPaymentDeadlineExpired } from "@/app/lib/paymentDeadline";

export const chatBookingSelect = {
  id: true, bookingNumber: true, status: true, createdAt: true, paymentStatus: true, paymentDueAt: true, depositCents: true,
  depositStatus: true, settlementCompletedAt: true, returnStatus: true, returnConfirmationStatus: true,
  incidents: { select: { stage: true, status: true, acceptedAt: true, refundCents: true, reason: true, reportedDeliveryDate: true } },
} satisfies Prisma.BookingSelect;

type ChatBooking = Prisma.BookingGetPayload<{ select: typeof chatBookingSelect }>;

export function isBookingChatClosed(booking: ChatBooking, now = new Date()) {
  if (booking.status === "PENDING" && getApprovalDeadline(booking.createdAt) <= now) return true;
  if (isPaymentDeadlineExpired(booking, now)) return true;
  const returned = ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.returnConfirmationStatus);
  if (booking.status === "CANCELLED") {
    const awaitingReturn = canReturnCancelledIncidentBooking(booking) && (
      ["SHIPPED", "DELIVERED"].includes(booking.returnStatus) ||
      booking.incidents.some(incident => incident.stage === "DELIVERY" && !missingDelivery(incident))
    );
    return returned || !awaitingReturn;
  }
  const settled = !!booking.settlementCompletedAt || ["REFUNDED", "PARTIALLY_REFUNDED", "RETAINED"].includes(booking.depositStatus);
  return returned && settled && !booking.incidents.some(incident => incident.status !== "RESOLVED");
}

export function isChatClosed(chat: {
  booking: ChatBooking | null;
  listing: { available: boolean; isDraft: boolean };
  closedReason: string | null;
  status: string;
}) {
  if (chat.booking) return isBookingChatClosed(chat.booking);
  return !chat.listing.available || chat.listing.isDraft || (chat.status === "CLOSED" && chat.closedReason === "OTHER");
}
