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
  | "LOST"
  | "CANCELLED";

export async function updateShippingAction(formData: FormData) {
  const session = (await getServerSession(authConfig)) as Session | null;
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  const rawStatus = String(formData.get("shippingStatus") || "");
  const carrier = String(formData.get("carrier") || "").trim();
  const trackingNumber = String(formData.get("trackingNumber") || "").trim();

  if (!bookingId) throw new Error("Brak bookingId");

  const allowed: ShippingStatus[] = [
    "NOT_REQUIRED",
    "PENDING",
    "READY",
    "SHIPPED",
    "DELIVERED",
    "LOST",
    "CANCELLED",
  ];

  const shippingStatus = rawStatus as ShippingStatus;
  if (!allowed.includes(shippingStatus)) {
    throw new Error("Nieprawidłowy status wysyłki");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      shippingStatus: true,
      shippedAt: true,
      deliveredAt: true,

      // permisos
      ownerId: true,

      // handshake entrega
      deliveryConfirmationStatus: true,
      deliveryConfirmBy: true,
      deliveryConfirmedAt: true,
    },
  });

  if (!booking) throw new Error("Rezerwacja nie istnieje");

  // ✅ Solo owner (snapshot)
  if (booking.ownerId !== userId) {
    throw new Error("Brak uprawnień (tylko właściciel)");
  }

  // ✅ Solo CONFIRMED/PAID
  if (booking.status !== "CONFIRMED" && booking.status !== "PAID") {
    throw new Error("Wysyłka jest dostępna tylko dla potwierdzonych rezerwacji");
  }

  // ✅ Bloqueo total si ya está entregado (shippingStatus final)
  if (booking.shippingStatus === "DELIVERED") {
    throw new Error("Nie można edytować — przesyłka została dostarczona");
  }

  const now = new Date();

  // ✅ Update base
  const data: Prisma.BookingUpdateInput = {
    shippingStatus,
    carrier: carrier || null,
    trackingNumber: trackingNumber || null,

    ...(shippingStatus === "SHIPPED" && !booking.shippedAt ? { shippedAt: now } : {}),
    ...(shippingStatus === "DELIVERED" && !booking.deliveredAt ? { deliveredAt: now } : {}),
  };

  /**
   * ✅ Iniciar confirmación SOLO cuando se marca como DELIVERED
   * - Solo si todavía no se pidió (NOT_REQUESTED)
   * - No pisar si ya está CONFIRMED/AUTO_CONFIRMED/DISPUTED
   */
  if (
    shippingStatus === "DELIVERED" &&
    booking.deliveryConfirmationStatus === "NOT_REQUESTED"
  ) {
    data.deliveryConfirmationStatus = "AWAITING_CONFIRMATION";

    // ventana para confirmar (ej. 48h)
    data.deliveryConfirmBy = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data,
  });

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/bookings`);
}