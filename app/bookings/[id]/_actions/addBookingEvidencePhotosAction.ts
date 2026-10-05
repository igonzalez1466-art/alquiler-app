"use server";

import { queueIncidentEmail, sendPendingIncidentEmails } from "@/app/lib/incidentNotification";
import { revalidatePath } from "next/cache";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { INCIDENT_PHOTOS_LOCKED_MESSAGE } from "@/app/lib/incidentPolicy";
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
    select: { incidents: { select: { stage: true, status: true } }, ownerId: true, renterId: true, status: true, paymentStatus: true, settlementCompletedAt: true,
      shippingStatus: true, shippedAt: true, deliveryConfirmationStatus: true, deliveryIssue: true,
      returnStatus: true, returnConfirmationStatus: true, returnIssue: true },
  });
  if (!booking || (booking.ownerId !== userId && booking.renterId !== userId) || booking.status === "CANCELLED" || booking.paymentStatus !== "PAID") {
    throw new Error("Nie możesz dodać zdjęć do tej rezerwacji.");
  }
  if (!canUploadBookingEvidence(booking, stage, userId)) {
    if (stage === "DELIVERY" && booking.ownerId === userId && (booking.shippedAt || !["PENDING", "READY"].includes(booking.shippingStatus))) {
      throw new Error("Po oznaczeniu dostawy jako „Wysłano” nie można już dodawać zdjęć.");
    }
    if (stage === "RETURN" && booking.renterId === userId && !["PENDING", "READY"].includes(booking.returnStatus)) {
      throw new Error("Po oznaczeniu zwrotu jako „Wysłano” nie można już dodawać zdjęć.");
    }
    throw new Error("Zdjęcia można dodać przed potwierdzeniem odbioru albo po zgłoszeniu problemu przez osobę odbierającą.");
  }

  const prepared = (await prepareBookingEvidencePhotoFiles(files)).map(photo => ({ bookingId, uploaderId: userId, stage, ...photo }));

  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
    const current = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { incidents: { select: { stage: true, status: true } }, ownerId: true, renterId: true, status: true, paymentStatus: true, settlementCompletedAt: true,
        shippingStatus: true, shippedAt: true, deliveryConfirmationStatus: true, deliveryIssue: true,
        returnStatus: true, returnConfirmationStatus: true, returnIssue: true },
    });
    if (!current || !canUploadBookingEvidence(current, stage, userId)) {
      throw new Error(stage === "DELIVERY" && current?.ownerId === userId && (current.shippedAt || !["PENDING", "READY"].includes(current.shippingStatus))
        ? "Po oznaczeniu dostawy jako „Wysłano” nie można już dodawać zdjęć."
        : stage === "RETURN" && current?.renterId === userId && !["PENDING", "READY"].includes(current.returnStatus)
          ? "Po oznaczeniu zwrotu jako „Wysłano” nie można już dodawać zdjęć."
          : "Zdjęcia można dodać przed potwierdzeniem odbioru albo po zgłoszeniu problemu przez osobę odbierającą.");
    }
    const existing = await tx.bookingEvidencePhoto.findMany({ where: { bookingId, stage, uploaderId: userId }, select: { slot: true } });
    const isClaim = current.incidents.some(incident => incident.stage === stage) || (stage === "DELIVERY" ? current.deliveryIssue : current.returnIssue) !== null;
    if (isClaim && existing.length) throw new Error(INCIDENT_PHOTOS_LOCKED_MESSAGE);
    const freeSlots = [1, 2, 3].filter(slot => !existing.some(photo => photo.slot === slot));
    if (freeSlots.length < prepared.length) throw new Error("Możesz dodać najwyżej 3 zdjęcia na tym etapie.");
    try {
      await tx.bookingEvidencePhoto.createMany({ data: prepared.map((photo, index) => ({ ...photo, slot: freeSlots[index] })) });
    } catch {
      throw new Error("Nie udało się zapisać zdjęć. Odśwież rezerwację i spróbuj ponownie.");
    }
    if (current.incidents.some(item => item.stage === stage)) {
      const incident = await tx.incident.findUniqueOrThrow({ where: { bookingId_stage: { bookingId, stage } } });
      await queueIncidentEmail(tx, incident, "photos", userId, `photos:${incident.id}:${userId}`, `Dodano ${prepared.length} zdjęcia do zgłoszenia.`);
    }
  });
  await sendPendingIncidentEmails(bookingId);
  revalidatePath(`/bookings/${bookingId}`);
}
