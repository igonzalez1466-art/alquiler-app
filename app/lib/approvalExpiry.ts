import { prisma } from "@/app/lib/prisma";

// Plazo del propietario para aceptar la solicitud.
export const APPROVAL_WINDOW_MS = 12 * 60 * 60 * 1000;

export function getApprovalDeadline(createdAt: Date) {
  return new Date(
    createdAt.getTime() + APPROVAL_WINDOW_MS
  );
}

export async function expirePendingBooking(
  bookingId: string
) {
  const now = new Date();

  const cutoff = new Date(
    now.getTime() - APPROVAL_WINDOW_MS
  );

  // La condición se comprueba al actualizar.
  // Una reserva ya aceptada no cumple status: PENDING.
  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: "PENDING",
      createdAt: {
        lte: cutoff,
      },
      paymentStatus: "PENDING",
      paidAt: null,
      paymentRef: null,
      cancelledAt: null,
    },
    data: {
      status: "CANCELLED",
      paymentStatus: "CANCELLED",
      cancelledAt: now,
      paymentDueAt: null,
    },
  });

  // Solo la ejecución que cancela realmente devuelve true.
  return result.count === 1;
}