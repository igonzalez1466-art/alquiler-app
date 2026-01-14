"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
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
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id as string | undefined;
  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  const shippingStatus = String(
    formData.get("shippingStatus") || ""
  ) as ShippingStatus;
  const carrier = String(formData.get("carrier") || "").trim();
  const trackingNumber = String(
    formData.get("trackingNumber") || ""
  ).trim();

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

  const data: Record<string, unknown> = {
    shippingStatus,
    carrier: carrier || null,
    trackingNumber: trackingNumber || null,
  };

  // ✅ Fechas automáticas (solo la primera vez)
  if (shippingStatus === "SHIPPED" && !booking.shippedAt) {
    data.shippedAt = now;
  }
  if (shippingStatus === "DELIVERED" && !booking.deliveredAt) {
    data.deliveredAt = now;
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: data as never,
  });

  // ✅ refresca UI
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/bookings`);
}
