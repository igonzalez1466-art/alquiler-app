"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import { trySettleRentOnlyBooking } from "@/app/lib/rentOnlySettlement";
import { receiptWhere } from "@/app/lib/logistics";


export async function confirmDeliveryAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");
  const bookingId = String(formData.get("bookingId") || "");
  if (!bookingId) throw new Error("Brak bookingId");
  const now = new Date();
  const updated = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
    if (await tx.incident.findFirst({ where: { bookingId, stage: "DELIVERY", status: { not: "RESOLVED" } } })) throw new Error("Najpierw uzgodnij rozwiązanie incydentu.");
    return tx.booking.updateMany({
    where: receiptWhere(bookingId, userId, "DELIVERY"),
    data: {
      shippingStatus: "DELIVERED",
      deliveredAt: now,
      deliveryConfirmationStatus: "CONFIRMED",
      deliveryConfirmedAt: now,
      deliveryConfirmedBy: "RENTER",
      deliveryConfirmBy: null,
    },
  });
  });
  if (updated.count !== 1) throw new Error("Nie można potwierdzić odbioru. Odśwież stronę.");

  await trySettleRentOnlyBooking(bookingId);
  revalidatePath("/bookings/" + bookingId);
  revalidatePath("/bookings");
}
