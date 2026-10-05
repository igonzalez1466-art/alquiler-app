import type { Prisma } from "@prisma/client";
import { readIssue } from "@/app/lib/logisticsIssue";

type EvidenceBooking = {
  ownerId: string;
  renterId: string;
  status: string;
  paymentStatus: string;
  settlementCompletedAt: Date | null;
  shippingStatus: string;
  shippedAt: Date | null;
  deliveryConfirmationStatus: string;
  deliveryIssue: Prisma.JsonValue | null;
  returnStatus: string;
  returnConfirmationStatus: string;
  returnIssue: Prisma.JsonValue | null;
};

const awaitingReceipt = ["NOT_REQUESTED", "AWAITING_CONFIRMATION"];

export function canUploadBookingEvidence(booking: EvidenceBooking, stage: "DELIVERY" | "RETURN", userId: string): boolean {
  if (booking.status === "CANCELLED" || booking.paymentStatus !== "PAID") return false;

  if (stage === "DELIVERY") {
    if (booking.ownerId === userId) return false;
    const issue = readIssue(booking.deliveryIssue);
    if (booking.renterId === userId && awaitingReceipt.includes(booking.deliveryConfirmationStatus) &&
      ["SHIPPED", "DELIVERED"].includes(booking.shippingStatus)) return true;
    return booking.renterId === userId && booking.deliveryConfirmationStatus === "DISPUTED" &&
      issue?.reportedById === userId && issue.resolvedAt === null;
  }

  if (booking.renterId === userId) {
    return ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.deliveryConfirmationStatus) &&
      ["PENDING", "READY"].includes(booking.returnStatus) && [...awaitingReceipt, "DISPUTED"].includes(booking.returnConfirmationStatus);
  }
  const issue = readIssue(booking.returnIssue);
  return booking.ownerId === userId && booking.returnConfirmationStatus === "DISPUTED" &&
    issue?.reportedById === userId && issue.resolvedAt === null;
}
