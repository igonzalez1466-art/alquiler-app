"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import type { BookingEvidenceStage } from "@prisma/client";

const MAX_PHOTOS_PER_PERSON_AND_STAGE = 3;
const MAX_PHOTO_BYTES = 750_000;

function validImage(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length > 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (type === "image/webp") return bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

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
      shippingStatus: true, deliveryConfirmationStatus: true, returnStatus: true },
  });
  if (!booking || (booking.ownerId !== userId && booking.renterId !== userId) || booking.status === "CANCELLED" || booking.paymentStatus !== "PAID" || booking.settlementCompletedAt) {
    throw new Error("Nie możesz dodać zdjęć do tej rezerwacji.");
  }
  const owner = booking.ownerId === userId;
  const canUpload = stage === "DELIVERY"
    ? owner ? ["PENDING", "READY", "SHIPPED", "DELIVERED"].includes(booking.shippingStatus) : ["SHIPPED", "DELIVERED"].includes(booking.shippingStatus)
    : owner ? ["SHIPPED", "DELIVERED"].includes(booking.returnStatus)
      : ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.deliveryConfirmationStatus) && ["PENDING", "READY", "SHIPPED", "DELIVERED"].includes(booking.returnStatus);
  if (!canUpload) throw new Error("Zdjęcia dodaj na właściwym etapie dostawy lub zwrotu.");

  const prepared = await Promise.all(files.map(async file => {
    if (file.size > MAX_PHOTO_BYTES) throw new Error("Każde zdjęcie może mieć maksymalnie 750 KB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validImage(file.type, bytes)) throw new Error("Dodaj zdjęcia JPG, PNG lub WebP.");
    return { bookingId, uploaderId: userId, stage, mimeType: file.type, data: bytes };
  }));

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
