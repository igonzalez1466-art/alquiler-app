"use server";

import { prisma, initSqlitePragmas } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth"; // ✅ AÑADIR
import { authConfig } from "@/auth.config";
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

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      renterId: true,
      listingId: true,
      listing: { select: { userId: true } },
    },
  });

  if (!booking) redirect("/bookings");

  if (booking.status === "CANCELLED") {
    redirect(`/bookings/${bookingId}?error=chat-closed`);
  }

  const ownerId = booking.listing.userId;
  const renterId = booking.renterId;

  if (currentUserId !== ownerId && currentUserId !== renterId) {
    redirect("/bookings");
  }

  const conversation = await prisma.conversation.upsert({
    where: {
      listingId_buyerId: {
        listingId: booking.listingId,
        buyerId: renterId,
      },
    },
    update: {},
    create: {
      listingId: booking.listingId,
      buyerId: renterId,
      sellerId: ownerId,
    },
    select: { id: true },
  });

  redirect(`/chat/${conversation.id}`);
}
