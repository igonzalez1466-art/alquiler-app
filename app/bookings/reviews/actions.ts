"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import type { NextAuthConfig } from "next-auth";
import type { ReviewRole } from "@prisma/client";

export async function createReviewAction(formData: FormData) {
  const session = await getServerSession(authConfig as NextAuthConfig);
  if (!session?.user?.id) throw new Error("No autorizado");

  const bookingId = String(formData.get("bookingId") || "");
  const rating = Number(formData.get("rating") || "0");
  const comment = String(formData.get("comment") || "").trim();

  if (!bookingId || !(rating >= 1 && rating <= 5)) {
    throw new Error("Datos inválidos");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: { select: { userId: true } },
    },
  });
  if (!booking) throw new Error("Reserva no encontrada");

  const now = new Date();
  if (booking.status !== "CONFIRMED" || booking.endDate > now) {
    throw new Error("Aún no puedes valorar esta reserva");
  }

  const userId = session.user.id;
  const ownerId = booking.listing.userId;
  const renterId = booking.renterId;

  let reviewerId: string;
  let revieweeId: string;
  let role: ReviewRole;

  if (userId === renterId) {
    reviewerId = renterId;
    revieweeId = ownerId;
    role = "OWNER";
  } else if (userId === ownerId) {
    reviewerId = ownerId;
    revieweeId = renterId;
    role = "RENTER";
  } else {
    throw new Error("No autorizado para valorar esta reserva");
  }

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

  revalidatePath("/bookings");
}
