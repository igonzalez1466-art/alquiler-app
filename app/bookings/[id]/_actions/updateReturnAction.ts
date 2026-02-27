"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";

type ReturnStatus = "PENDING" | "READY" | "SHIPPED" | "DELIVERED" | "LOST" | "CANCELLED";

export async function updateReturnAction(formData: FormData) {
  const session = (await getServerSession(authConfig)) as Session | null;

  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  const rawReturnStatus = String(formData.get("returnStatus") || "");

// normaliza valores legacy por si el frontend manda algo viejo
const normalizedReturnStatus =
  rawReturnStatus === "RETURN_PENDING" ? "PENDING" :
  rawReturnStatus === "RETURNED" ? "DELIVERED" :
  rawReturnStatus;

const returnStatus = normalizedReturnStatus as ReturnStatus;
const allowed: ReturnStatus[] = ["PENDING", "READY", "SHIPPED", "DELIVERED", "LOST", "CANCELLED"];
if (!allowed.includes(returnStatus)) throw new Error("Nieprawidłowy status zwrotu");
  const returnCarrier = String(formData.get("returnCarrier") || "").trim();
  const returnTrackingNumber = String(formData.get("returnTrackingNumber") || "").trim();

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
      returnConfirmationStatus: true,
    },
  });
  if (!booking) throw new Error("Rezerwacja nie istnieje");

  if (booking.renterId !== userId) throw new Error("Brak uprawnień (tylko najemca)");
  if (booking.status !== "CONFIRMED") throw new Error("Zwrot tylko dla potwierdzonych rezerwacji");

  if (
  booking.returnConfirmationStatus === "CONFIRMED" ||
  booking.returnConfirmationStatus === "AUTO_CONFIRMED"
) {
  throw new Error("Nie można edytować — zwrot został zakończony");
}
  const now = new Date();

  const data: Record<string, unknown> = {
    returnStatus,
    returnCarrier: returnCarrier || null,
    returnTrackingNumber: returnTrackingNumber || null,
  };

  if (returnStatus === "SHIPPED" && !booking.returnShippedAt) data.returnShippedAt = now;
  if (returnStatus === "DELIVERED" && !booking.returnDeliveredAt) data.returnDeliveredAt = now;

  await prisma.booking.update({
    where: { id: bookingId },
    data: data as never,
  });

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/bookings`);
}
