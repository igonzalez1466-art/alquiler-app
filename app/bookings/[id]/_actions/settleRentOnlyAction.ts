"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authConfig } from "@/auth.config";
import { prisma } from "@/app/lib/prisma";
import { settleRentOnlyBooking } from "@/app/lib/rentOnlySettlement";

export async function settleRentOnlyAction(bookingId: string) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu.");
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { ownerId: true } });
  if (!booking || booking.ownerId !== userId) throw new Error("Brak dostępu.");
  await settleRentOnlyBooking(bookingId);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
}
