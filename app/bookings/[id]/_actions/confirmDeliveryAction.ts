// app/bookings/[id]/_actions/confirmDeliveryAction.ts
"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";

export async function confirmDeliveryAction(bookingId: string) {
  const session = (await getServerSession(authConfig)) as Session | null;
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      renterId: true,
      status: true,
      deliveryConfirmationStatus: true,
    },
  });

  if (!booking) throw new Error("Rezerwacja nie istnieje");

  // ✅ solo najemca może potwierdzić odbiór
  if (booking.renterId !== userId) {
    throw new Error("Brak uprawnień (tylko najemca)");
  }

  // ✅ tylko w odpowiednim stanie
  if (booking.deliveryConfirmationStatus !== "AWAITING_CONFIRMATION") {
    throw new Error("Nie można potwierdzić odbioru na tym etapie");
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      deliveryConfirmationStatus: "CONFIRMED",
      deliveryConfirmedAt: new Date(),
      deliveryConfirmedBy: "RENTER",
    },
  });

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/bookings`);
}