"use server";

import { getSession } from "@/app/lib/auth";
import { readInpostPoint } from "@/app/lib/inpostPoint";
import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateInpostPointAction(formData: FormData) {
  const userId = (await getSession())?.user?.id;
  if (!userId) throw new Error("Brak dostępu.");

  const bookingId = String(formData.get("bookingId") ?? "");
  const stage = formData.get("stage");
  if (!bookingId || (stage !== "DELIVERY" && stage !== "RETURN")) {
    throw new Error("Nieprawidłowa rezerwacja lub etap wysyłki.");
  }
  const point = readInpostPoint(formData);

  const updated = stage === "DELIVERY"
    ? await prisma.booking.updateMany({
        where: {
          id: bookingId,
          renterId: userId,
          status: { not: "CANCELLED" },
          paymentStatus: "PAID",
          shippingStatus: { notIn: ["SHIPPED", "DELIVERED"] },
        },
        data: {
          deliveryInpostPointCode: point.code,
          deliveryInpostPointAddress: point.address,
        },
      })
    : await prisma.booking.updateMany({
        where: {
          id: bookingId,
          ownerId: userId,
          status: { not: "CANCELLED" },
          paymentStatus: "PAID",
          returnStatus: { notIn: ["SHIPPED", "DELIVERED"] },
        },
        data: {
          returnInpostPointCode: point.code,
          returnInpostPointAddress: point.address,
        },
      });

  if (updated.count !== 1) {
    throw new Error("Nie można już zmienić punktu dla tej przesyłki. Odśwież stronę.");
  }
  revalidatePath(`/bookings/${bookingId}`);
}
