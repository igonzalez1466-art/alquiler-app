"use server";

import { prisma, initSqlitePragmas } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth"; // ✅ AÑADIR
import { authConfig } from "@/auth.config";
import { chatBookingSelect, isBookingChatClosed } from "@/app/lib/chatAccess";
import { redirect } from "next/navigation";
import { updateShippingAction as updateShipping } from "./_actions/updateShippingAction";

export async function updateShippingAction(formData: FormData) {
  await updateShipping(formData);
}

/* ===============================
   OPEN CHAT FROM BOOKING ✅
================================ */

export async function openChatFromBookingAction(formData: FormData) {
  await initSqlitePragmas();

  const session = (await getServerSession(authConfig)) as Session | null; // ✅ CAMBIO
  const currentUserId = session?.user?.id;
  if (!currentUserId) redirect("/login");

  const bookingId = formData.get("bookingId")?.toString();
  if (!bookingId) redirect("/bookings");

  const conversation = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { ...chatBookingSelect, renterId: true, ownerId: true, listingId: true, conversation: { select: { id: true } } },
    });
    if (!booking || (currentUserId !== booking.ownerId && currentUserId !== booking.renterId)) redirect("/bookings");
    if (booking.conversation) return booking.conversation;
    if (isBookingChatClosed(booking)) redirect(`/bookings/${bookingId}`);
    return tx.conversation.create({
      data: { bookingId, listingId: booking.listingId, buyerId: booking.renterId, sellerId: booking.ownerId },
      select: { id: true },
    });
  });

  redirect(`/chat/${conversation.id}`);
}
