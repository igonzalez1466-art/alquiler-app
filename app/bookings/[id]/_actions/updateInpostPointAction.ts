"use server";

import { getSession } from "@/app/lib/auth";
import { fetchInpostPointAddress, readInpostPoint } from "@/app/lib/inpostPoint";
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
  const pointAddress = (await fetchInpostPointAddress(point.code)) ?? point.address;

  const updated = stage === "DELIVERY"
    ? await prisma.booking.updateMany({
        where: {
          id: bookingId,
          renterId: userId,
          status: { not: "CANCELLED" },
          paymentStatus: "PAID",
          shippingStatus: { notIn: ["SHIPPED", "DELIVERED"] },
          deliveryInpostPointCode: null,
        },
        data: {
          deliveryInpostPointCode: point.code,
          deliveryInpostPointAddress: pointAddress,
        },
      })
    : await prisma.booking.updateMany({
        where: {
          id: bookingId,
          ownerId: userId,
          status: { not: "CANCELLED" },
          paymentStatus: "PAID",
          returnStatus: { notIn: ["SHIPPED", "DELIVERED"] },
          returnInpostPointCode: null,
        },
        data: {
          returnInpostPointCode: point.code,
          returnInpostPointAddress: pointAddress,
        },
      });

  if (updated.count !== 1) {
    throw new Error("Punkt został już potwierdzony lub nie można go potwierdzić dla tej przesyłki. Odśwież stronę.");
  }
  revalidatePath(`/bookings/${bookingId}`);
  return pointAddress;
}

export async function lookupBookingInpostPointAddressAction(code: string) {
  const userId = (await getSession())?.user?.id;
  if (!userId) throw new Error("Brak dostępu.");
  return fetchInpostPointAddress(code.trim().toUpperCase());
}
