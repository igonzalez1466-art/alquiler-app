"use server";

import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";

type ShippingStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "READY"
  | "SHIPPED"
  | "DELIVERED"
  | "RETURN_PENDING"
  | "RETURNED"
  | "LOST"
  | "CANCELLED";

export async function updateShippingAction(formData: FormData) {
  const session = (await getServerSession(authConfig)) as Session | null;
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  const shippingStatus = String(
    formData.get("shippingStatus") || ""
  ) as ShippingStatus;
  const carrier = String(formData.get("carrier") || "").trim();
  const trackingNumber = String(formData.get("trackingNumber") || "").trim();

  if (!bookingId) throw new Error("Brak bookingId");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      shippingStatus: true,
      shippedAt: true,
      deliveredAt: true,
      listing: { select: { userId: true } },
    },
  });

  if (!booking) throw new Error("Rezerwacja nie istnieje");

  // ✅ Solo owner
  if (booking.listing.userId !== userId) {
    throw new Error("Brak uprawnień (tylko właściciel)");
  }

  // ✅ Solo cuando la reserva está confirmada
  if (booking.status !== "CONFIRMED") {
    throw new Error("Wysyłka jest dostępna tylko dla potwierdzonych rezerwacji");
  }

  // ✅ Bloqueo total si ya está entregado
  if (booking.shippingStatus === "DELIVERED") {
    throw new Error("Nie można edytować — przesyłka została dostarczona");
  }

  const now = new Date();

  // ✅ Prisma bien tipado
  const data: Prisma.BookingUpdateInput = {
    shippingStatus,
    carrier: carrier || null,
    trackingNumber: trackingNumber || null,

    ...(shippingStatus === "SHIPPED" && !booking.shippedAt
      ? { shippedAt: now }
      : {}),

    ...(shippingStatus === "DELIVERED" && !booking.deliveredAt
      ? { deliveredAt: now }
      : {}),
  };

  await prisma.booking.update({
    where: { id: bookingId },
    data,
  });

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/bookings`);
}
