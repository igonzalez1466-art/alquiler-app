"use server";

import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";

type ReturnStatus =
  | "PENDING"
  | "READY"
  | "SHIPPED"
  | "DELIVERED"
  | "LOST"
  | "CANCELLED";

export async function updateReturnAction(formData: FormData) {
  const session = (await getServerSession(authConfig)) as Session | null;
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  const rawReturnStatus = String(formData.get("returnStatus") || "");
  const returnCarrier = String(formData.get("returnCarrier") || "").trim();
  const returnTrackingNumber = String(formData.get("returnTrackingNumber") || "").trim();

  if (!bookingId) throw new Error("Brak bookingId");

  // normaliza valores legacy por si el frontend manda algo viejo
  const normalizedReturnStatus =
    rawReturnStatus === "RETURN_PENDING"
      ? "PENDING"
      : rawReturnStatus === "RETURNED"
      ? "DELIVERED"
      : rawReturnStatus;

  const returnStatus = normalizedReturnStatus as ReturnStatus;
  const allowed: ReturnStatus[] = [
    "PENDING",
    "READY",
    "SHIPPED",
    "DELIVERED",
    "LOST",
    "CANCELLED",
  ];

  if (!allowed.includes(returnStatus)) {
    throw new Error("Nieprawidłowy status zwrotu");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      renterId: true,

      // ✅ entrega
      shippingStatus: true,
      deliveryConfirmationStatus: true,

      // ✅ zwrot
      returnStatus: true,
      returnShippedAt: true,
      returnDeliveredAt: true,

      // ✅ handshake zwrotu
      returnConfirmationStatus: true,
      returnConfirmBy: true,
      returnConfirmedAt: true,
    },
  });

  if (!booking) throw new Error("Rezerwacja nie istnieje");

  // ✅ solo renter
  if (booking.renterId !== userId) {
    throw new Error("Brak uprawnień (tylko najemca)");
  }

  // ✅ solo reserva pagada
  if (booking.status !== "PAID") {
    throw new Error("Zwrot można uzupełnić dopiero po opłaceniu rezerwacji");
  }

  // ✅ NUEVO: solo permitir zwrot después de entrega completada
  const deliveryCompleted =
    booking.shippingStatus === "DELIVERED" &&
    (booking.deliveryConfirmationStatus === "CONFIRMED" ||
      booking.deliveryConfirmationStatus === "AUTO_CONFIRMED");

  if (!deliveryCompleted) {
    throw new Error("Zwrot można uzupełnić dopiero po potwierdzeniu dostawy");
  }

  // ✅ bloqueo total si ya confirmado el zwrot
  if (
    booking.returnConfirmationStatus === "CONFIRMED" ||
    booking.returnConfirmationStatus === "AUTO_CONFIRMED"
  ) {
    throw new Error("Nie można edytować — zwrot został zakończony");
  }

  const now = new Date();

  const data: Prisma.BookingUpdateInput = {
    returnStatus,
    returnCarrier: returnCarrier || null,
    returnTrackingNumber: returnTrackingNumber || null,

    ...(returnStatus === "SHIPPED" && !booking.returnShippedAt
      ? { returnShippedAt: now }
      : {}),

    ...(returnStatus === "DELIVERED" && !booking.returnDeliveredAt
      ? { returnDeliveredAt: now }
      : {}),
  };

  /**
   * ✅ Iniciar confirmación SOLO cuando renter marca DELIVERED
   * - Solo si todavía no se pidió (NOT_REQUESTED)
   * - No pisar si ya está en disputa / etc.
   */
  if (
    returnStatus === "DELIVERED" &&
    booking.returnConfirmationStatus === "NOT_REQUESTED"
  ) {
    data.returnConfirmationStatus = "AWAITING_CONFIRMATION";
    // ventana para confirmar (48h)
    data.returnConfirmBy = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data,
  });

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/bookings`);
}