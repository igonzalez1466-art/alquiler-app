"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import type { ReviewRole } from "@prisma/client";

export async function createReviewAction(formData: FormData) {
  const session = (await getServerSession(authConfig)) as Session | null;

  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak uprawnień.");

  const bookingId = String(formData.get("bookingId") || "");
  const rating = Number(formData.get("rating") || "0");
  const comment = String(formData.get("comment") || "").trim();

  if (!bookingId || !(rating >= 1 && rating <= 5)) {
    throw new Error("Nieprawidłowe dane.");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: { select: { userId: true } },
    },
  });
  if (!booking) throw new Error("Nie znaleziono rezerwacji.");

  const now = new Date();
  if (booking.status !== "CONFIRMED" || booking.endDate > now) {
    throw new Error("Nie możesz jeszcze ocenić tej rezerwacji.");
  }

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
    throw new Error("Brak uprawnień do oceny tej rezerwacji.");
  }

  const exists = await prisma.review.findFirst({
    where: { bookingId, reviewerId, revieweeId },
    select: { id: true },
  });
  if (exists) throw new Error("Ta rezerwacja została już przez Ciebie oceniona.");

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
