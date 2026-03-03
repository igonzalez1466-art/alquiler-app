"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";

export async function confirmDeliveryAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;

  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  if (!bookingId) throw new Error("Brak bookingId");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      renterId: true,
      deliveryConfirmationStatus: true,
    },
  });

  if (!booking) throw new Error("Rezerwacja nie istnieje");

  // solo el inquilino puede confirmar
  if (booking.renterId !== userId) {
    throw new Error("Brak uprawnień");
  }

  if (booking.deliveryConfirmationStatus !== "AWAITING_CONFIRMATION") {
    throw new Error("Nie można potwierdzić odbioru");
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      deliveryConfirmationStatus: "CONFIRMED",
      deliveryConfirmedAt: new Date(),
    },
  });

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/bookings`);
}