"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";

export async function confirmReturnAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;

  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  if (!bookingId) throw new Error("Brak bookingId");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      paymentStatus: true,

      // entrega
      shippingStatus: true,
      deliveryConfirmationStatus: true,

      // retorno
      returnStatus: true,
      returnConfirmationStatus: true,
    },
  });

  if (!booking) throw new Error("Rezerwacja nie istnieje");

  // solo owner
  if (booking.ownerId !== userId) {
    throw new Error("Brak uprawnień");
  }

  // solo reservas pagadas
  if (booking.paymentStatus !== "PAID") {
    throw new Error("Zwrot można potwierdzić dopiero po opłaceniu rezerwacji");
  }

  // la entrega debe haberse completado antes
  const deliveryCompleted =
    booking.shippingStatus === "DELIVERED" &&
    (booking.deliveryConfirmationStatus === "CONFIRMED" ||
      booking.deliveryConfirmationStatus === "AUTO_CONFIRMED");

  if (!deliveryCompleted) {
    throw new Error("Nie można potwierdzić zwrotu przed potwierdzeniem dostawy");
  }

  // el retorno debe estar esperando confirmación
  if (booking.returnConfirmationStatus !== "AWAITING_CONFIRMATION") {
    throw new Error("Nie można potwierdzić zwrotu");
  }

  // además, el najemca debe haber marcado el zwrot como dostarczony
  if (booking.returnStatus !== "DELIVERED") {
    throw new Error("Zwrot musi mieć status 'Dostarczono'");
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      returnConfirmationStatus: "CONFIRMED",
      returnConfirmedAt: new Date(),
    },
  });

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/bookings`);
}