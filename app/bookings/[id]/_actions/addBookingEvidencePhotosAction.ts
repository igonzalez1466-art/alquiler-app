"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { canUploadBookingEvidence } from "@/app/lib/bookingEvidence";
import { MAX_PHOTOS_PER_PERSON_AND_STAGE, prepareBookingEvidencePhotoFiles } from "@/app/lib/bookingEvidencePhotoFiles";
import type { BookingEvidenceStage } from "@prisma/client";

export async function addBookingEvidencePhotosAction(formData: FormData) {
  const userId = (await getSession())?.user?.id;
  if (!userId) throw new Error("Zaloguj się, aby dodać zdjęcia.");
  const bookingId = String(formData.get("bookingId") ?? "");
  const stage = String(formData.get("stage") ?? "") as BookingEvidenceStage;
  if (!bookingId || !["DELIVERY", "RETURN"].includes(stage)) throw new Error("Nieprawidłowa rezerwacja.");
  const files = formData.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length < 1 || files.length > MAX_PHOTOS_PER_PERSON_AND_STAGE) throw new Error("Wybierz od 1 do 3 zdjęć.");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { ownerId: true, renterId: true, status: true, paymentStatus: true, settlementCompletedAt: true,
      shippingStatus: true, deliveryConfirmationStatus: true, deliveryIssue: true,
      returnStatus: true, returnConfirmationStatus: true, returnIssue: true },
  });
  if (!booking || (booking.ownerId !== userId && booking.renterId !== userId) || booking.status === "CANCELLED" || booking.paymentStatus !== "PAID" || booking.settlementCompletedAt) {
    throw new Error("Nie możesz dodać zdjęć do tej rezerwacji.");
  }
  if (!canUploadBookingEvidence(booking, stage, userId)) {
    throw new Error("Zdjęcia można dodać przed potwierdzeniem odbioru albo po zgłoszeniu problemu przez osobę odbierającą.");
  }

  const prepared = (await prepareBookingEvidencePhotoFiles(files)).map(photo => ({ bookingId, uploaderId: userId, stage, ...photo }));

  const existing = await prisma.bookingEvidencePhoto.findMany({ where: { bookingId, stage, uploaderId: userId }, select: { slot: true } });
  const freeSlots = [1, 2, 3].filter(slot => !existing.some(photo => photo.slot === slot));
  if (freeSlots.length < prepared.length) throw new Error("Możesz dodać najwyżej 3 zdjęcia na tym etapie.");
  try {
    await prisma.bookingEvidencePhoto.createMany({ data: prepared.map((photo, index) => ({ ...photo, slot: freeSlots[index] })) });
  } catch {
    throw new Error("Nie udało się zapisać zdjęć. Odśwież rezerwację i spróbuj ponownie.");
  }
  revalidatePath(`/bookings/${bookingId}`);
}
