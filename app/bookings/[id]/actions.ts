"use server";

import { prisma, initSqlitePragmas } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/* ===============================
   UPDATE SHIPPING
================================ */

const ALLOWED_SHIPPING = new Set([
  "NOT_REQUIRED",
  "PENDING",
  "READY",
  "SHIPPED",
  "DELIVERED",
  "RETURN_PENDING",
  "RETURNED",
  "LOST",
  "CANCELLED",
]);

export async function updateShippingAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id as string | undefined;
  if (!userId) throw new Error("Brak autoryzacji");

  const bookingId = String(formData.get("bookingId") || "");
  if (!bookingId) throw new Error("Brak bookingId");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, listing: { select: { userId: true } } },
  });
  if (!booking) throw new Error("Nie znaleziono rezerwacji");
  if (booking.listing.userId !== userId) throw new Error("Brak uprawnień");

  if (booking.status !== "CONFIRMED" && booking.status !== "PAID") {
    throw new Error("Wysyłkę można edytować dopiero po potwierdzeniu rezerwacji");
  }

  const shippingStatusRaw = String(formData.get("shippingStatus") || "").trim();
  const shippingStatus = ALLOWED_SHIPPING.has(shippingStatusRaw)
    ? shippingStatusRaw
    : undefined;

  const carrier = String(formData.get("carrier") || "").trim() || null;
  const trackingNumber = String(formData.get("trackingNumber") || "").trim() || null;

  const shippedAtStr = String(formData.get("shippedAt") || "").trim();
  const deliveredAtStr = String(formData.get("deliveredAt") || "").trim();

  const shippedAt = shippedAtStr ? new Date(shippedAtStr) : null;
  const deliveredAt = deliveredAtStr ? new Date(deliveredAtStr) : null;

  if (shippedAt && isNaN(shippedAt.getTime()))
    throw new Error("Nieprawidłowa data wysyłki");
  if (deliveredAt && isNaN(deliveredAt.getTime()))
    throw new Error("Nieprawidłowa data dostarczenia");

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      ...(shippingStatus ? { shippingStatus: shippingStatus as any } : {}),
      carrier,
      trackingNumber,
      shippedAt,
      deliveredAt,
    },
  });

  revalidatePath(`/bookings/${bookingId}`);
}

/* ===============================
   OPEN CHAT FROM BOOKING ✅
   - solo si booking sigue "viva"
   - conversación única listing+renter
   - si el chat está CLOSED -> permite leer, no escribir (eso se bloquea en sendMessage)
================================ */

export async function openChatFromBookingAction(formData: FormData) {
  await initSqlitePragmas();

  const session = await getServerSession(authConfig);
  const currentUserId = session?.user?.id;
  if (!currentUserId) redirect("/api/auth/signin");

  const bookingId = formData.get("bookingId")?.toString();
  if (!bookingId) redirect("/bookings");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      renterId: true,
      listingId: true,
      listing: { select: { userId: true } }, // owner
    },
  });

  if (!booking) redirect("/bookings");

  // ✅ regla: chat solo para reservas que siguen adelante
  if (booking.status === "CANCELLED") {
    redirect(`/bookings/${bookingId}?error=chat-closed`);
  }

  const ownerId = booking.listing.userId;
  const renterId = booking.renterId;

  // Seguridad: solo owner o renter
  if (currentUserId !== ownerId && currentUserId !== renterId) {
    redirect("/bookings");
  }

  // 🔑 Conversación ÚNICA por listing + renter
  // Importante: no reabrimos un chat cerrado
  const conversation = await prisma.conversation.upsert({
    where: {
      listingId_buyerId: {
        listingId: booking.listingId,
        buyerId: renterId,
      },
    },
    update: {
      // ❗ NO reabrir automáticamente
      // status: "OPEN"  <-- NO
    },
    create: {
      listingId: booking.listingId,
      buyerId: renterId,
      sellerId: ownerId,
      // status: "OPEN"  // default
    },
    select: { id: true },
  });

  redirect(`/chat/${conversation.id}`);
}
