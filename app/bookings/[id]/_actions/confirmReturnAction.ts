// app/bookings/[id]/_actions/confirmReturnAction.ts
"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";

export async function confirmReturnAction(bookingId: string) {
  const session = (await getServerSession(authConfig)) as Session | null;
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      returnConfirmationStatus: true,
    },
  });

  if (!booking) throw new Error("Rezerwacja nie istnieje");

  // ✅ solo właściciel może potwierdzić zwrot
  if (booking.ownerId !== userId) {
    throw new Error("Brak uprawnień (tylko właściciel)");
  }

  // ✅ tylko w odpowiednim stanie
  if (booking.returnConfirmationStatus !== "AWAITING_CONFIRMATION") {
    throw new Error("Nie można potwierdzić zwrotu na tym etapie");
  }

  const now = new Date();

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      returnConfirmationStatus: "CONFIRMED",
      returnConfirmedAt: now,
      returnConfirmedBy: "OWNER",

      // ✅ start okna na zgłoszenie szkód (48h)
      damageClaimStatus: "OPEN",
      damageClaimBy: new Date(now.getTime() + 48 * 60 * 60 * 1000),
    },
  });

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/bookings`);
}