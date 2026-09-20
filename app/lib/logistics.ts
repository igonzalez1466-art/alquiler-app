import type { Prisma } from "@prisma/client";

type ReceiptState = {
  status: string;
  paymentStatus: string;
  shippingStatus: string;
  deliveryConfirmationStatus: string;
  returnStatus: string;
  returnConfirmationStatus: string;
};

export function canReceive(booking: ReceiptState, stage: "DELIVERY" | "RETURN") {
  if (booking.status === "CANCELLED" || booking.paymentStatus !== "PAID") return false;
  if (stage === "RETURN" && (booking.shippingStatus !== "DELIVERED" ||
    !["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.deliveryConfirmationStatus))) return false;
  const status = stage === "DELIVERY" ? booking.shippingStatus : booking.returnStatus;
  const confirmation = stage === "DELIVERY" ? booking.deliveryConfirmationStatus : booking.returnConfirmationStatus;
  return ["SHIPPED", "DELIVERED"].includes(status) &&
    ["NOT_REQUESTED", "AWAITING_CONFIRMATION"].includes(confirmation);
}

// Atomic predicates keep confirmation and problem reporting mutually exclusive.
// NOT_REQUESTED supports shipments created before the simplified flow.
export function receiptWhere(id: string, userId: string, stage: "DELIVERY" | "RETURN"): Prisma.BookingWhereInput {
  const common = { id, status: { not: "CANCELLED" as const }, paymentStatus: "PAID" as const };
  return stage === "DELIVERY" ? {
    ...common, renterId: userId,
    shippingStatus: { in: ["SHIPPED", "DELIVERED"] },
    deliveryConfirmationStatus: { in: ["NOT_REQUESTED", "AWAITING_CONFIRMATION"] },
  } : {
    ...common, ownerId: userId,
    shippingStatus: "DELIVERED",
    deliveryConfirmationStatus: { in: ["CONFIRMED", "AUTO_CONFIRMED"] },
    returnStatus: { in: ["SHIPPED", "DELIVERED"] },
    returnConfirmationStatus: { in: ["NOT_REQUESTED", "AWAITING_CONFIRMATION"] },
  };
}
