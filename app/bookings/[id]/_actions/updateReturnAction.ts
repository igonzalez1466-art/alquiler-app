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

export async function updateReturnAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id as string | undefined;
  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  const returnStatus = String(
    formData.get("returnStatus") || ""
  ) as ShippingStatus;
  const returnCarrier = String(formData.get("returnCarrier") || "").trim();
  const returnTrackingNumber = String(
    formData.get("returnTrackingNumber") || ""
  ).trim();

  if (!bookingId) throw new Error("Brak bookingId");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      renterId: true,
      returnStatus: true,
      returnShippedAt: true,
      returnDeliveredAt: true,
    },
  });
  if (!booking) throw new Error("Rezerwacja nie istnieje");

  const isRenter = booking.renterId === userId;
  if (!isRenter) throw new Error("Brak uprawnień (tylko najemca)");

  if (booking.status !== "CONFIRMED")
    throw new Error("Zwrot tylko dla potwierdzonych rezerwacji");

  // 🔒 Bloqueo total al estar RETURNED
  if (booking.returnStatus === "RETURNED") {
    throw new Error("Nie można edytować — zwrot został zakończony");
  }

  const now = new Date();

  const data: Record<string, unknown> = {
    returnStatus,
    returnCarrier: returnCarrier || null,
    returnTrackingNumber: returnTrackingNumber || null,
  };

  // Fechas automáticas del retorno
  if (returnStatus === "SHIPPED" && !booking.returnShippedAt)
    data.returnShippedAt = now;

  if (returnStatus === "RETURNED" && !booking.returnDeliveredAt)
    data.returnDeliveredAt = now;

  await prisma.booking.update({
    where: { id: bookingId },
    data: data as never,
  });

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/bookings`);
}
