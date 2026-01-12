"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";

export async function createReviewAction(formData: FormData) {
  const session = await getServerSession(authConfig as any);
  if (!session?.user?.id) throw new Error("No autorizado");

  const bookingId = String(formData.get("bookingId") || "");
  const rating = Number(formData.get("rating") || "0");
  const comment = String(formData.get("comment") || "").trim();

  if (!bookingId || !(rating >= 1 && rating <= 5)) {
    throw new Error("Datos inválidos");
  }

  // Cargamos la reserva para validar participantes y estado
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: { select: { userId: true } },
    },
  });
  if (!booking) throw new Error("Reserva no encontrada");

  // Solo se puede valorar si está CONFIRMED y ya finalizó
  const now = new Date();
  if (booking.status !== "CONFIRMED" || booking.endDate > now) {
    throw new Error("Aún no puedes valorar esta reserva");
  }

  const userId = session.user.id;
  const ownerId = booking.listing.userId;
  const renterId = booking.renterId;

  // ¿quién escribe y a quién valora?
  let reviewerId: string;
  let revieweeId: string;
  let role: "OWNER" | "RENTER";

  if (userId === renterId) {
    reviewerId = renterId;   // inquilino
    revieweeId = ownerId;    // valora al propietario
    role = "OWNER";
  } else if (userId === ownerId) {
    reviewerId = ownerId;    // propietario
    revieweeId = renterId;   // valora al inquilino
    role = "RENTER";
  } else {
    throw new Error("No autorizado para valorar esta reserva");
  }

  // Evita duplicados por booking+dirección
  const exists = await prisma.review.findFirst({
    where: { bookingId, reviewerId, revieweeId },
    select: { id: true },
  });
  if (exists) throw new Error("Ya has valorado en esta reserva");

  await prisma.review.create({
    data: {
      bookingId,
      reviewerId,
      revieweeId,
      role,
      rating,
      comment: comment || null,
    },
  });

  // Opcional: actualizar denormalizados en User
  // const agg = await prisma.review.aggregate({ _avg: { rating: true }, _count: true, where: { revieweeId }});
  // await prisma.user.update({ where: { id: revieweeId }, data: { ratingAvgReceived: agg._avg.rating ?? 0, ratingCountReceived: agg._count } });

  revalidatePath("/bookings"); // refresca la página
}
