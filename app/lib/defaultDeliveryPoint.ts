import { prisma } from "@/app/lib/prisma";

// Preserve explicit reservation destinations and freeze them once dispatched.
export async function assignDefaultDeliveryPoint(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: {
    status: true, paymentStatus: true, shippingStatus: true, shippedAt: true,
    deliveryInpostPointCode: true, deliveryInpostPointAddress: true,
    renter: { select: { preferredInpostPointCode: true, preferredInpostPointAddress: true } },
  } });
  if (!booking) return null;
  if (!booking.deliveryInpostPointCode && booking.status !== "CANCELLED" &&
      booking.paymentStatus === "PAID" && !booking.shippedAt &&
      ["PENDING", "READY"].includes(booking.shippingStatus) && booking.renter.preferredInpostPointCode) {
    await prisma.booking.updateMany({ where: {
      id: bookingId, status: { not: "CANCELLED" }, paymentStatus: "PAID",
      shippingStatus: { in: ["PENDING", "READY"] }, shippedAt: null, deliveryInpostPointCode: null,
    }, data: {
      deliveryInpostPointCode: booking.renter.preferredInpostPointCode,
      deliveryInpostPointAddress: booking.renter.preferredInpostPointAddress,
    } });
    return prisma.booking.findUnique({ where: { id: bookingId }, select: {
      deliveryInpostPointCode: true, deliveryInpostPointAddress: true,
    } });
  }
  return booking;
}
