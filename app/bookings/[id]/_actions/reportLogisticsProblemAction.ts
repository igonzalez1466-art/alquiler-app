"use server";

import { notifyLogisticsIssue } from "@/app/lib/logisticsIssueEmail";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import { receiptWhere } from "@/app/lib/logistics";
import { validateIssueInput, issueConfirmsReceipt, type IssueDetails } from "@/app/lib/logisticsIssue";
import { MAX_PHOTOS_PER_PERSON_AND_STAGE, prepareBookingEvidencePhotoFiles } from "@/app/lib/bookingEvidencePhotoFiles";

export async function reportLogisticsProblemAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");
  const bookingId = String(formData.get("bookingId") || "");
  const stage = String(formData.get("stage") || "");
  if (!bookingId || (stage !== "DELIVERY" && stage !== "RETURN")) throw new Error("Nieprawidłowe zgłoszenie");
  const input = validateIssueInput(formData);
  if (input.reason === "OTHER" && !["yes", "no"].includes(String(formData.get("received")))) throw new Error("Wskaż, czy przedmiot został odebrany.");
  const files = formData.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > MAX_PHOTOS_PER_PERSON_AND_STAGE) throw new Error("Możesz dodać najwyżej 3 zdjęcia.");
  if (files.length && !["DAMAGED", "MISSING_ITEMS"].includes(input.reason)) {
    throw new Error("Zdjęcia dodaj przy zgłoszeniu uszkodzenia lub brakujących elementów.");
  }
  const preparedPhotos = await prepareBookingEvidencePhotoFiles(files);
  const now = new Date();
  const issue: IssueDetails = {
    ...input,
    received: input.reason === "DAMAGED" || input.reason === "MISSING_ITEMS" || (input.reason === "OTHER" && formData.get("received") === "yes"),
    reportedById: userId,
    reportedAt: now.toISOString(),
    resolvedById: null,
    resolvedAt: null,
  };
  await prisma.$transaction(async tx => {
    const updated = await tx.booking.updateMany({
      where: receiptWhere(bookingId, userId, stage),
      data: stage === "DELIVERY" ? {
        ...(issueConfirmsReceipt(issue) ? { shippingStatus: "DELIVERED", deliveredAt: now } : {}),
        deliveryConfirmationStatus: "DISPUTED", deliveryConfirmBy: null, deliveryIssue: issue,
      } : {
        ...(issueConfirmsReceipt(issue) ? { returnStatus: "DELIVERED", returnDeliveredAt: now } : {}),
        returnConfirmationStatus: "DISPUTED", returnConfirmBy: null, returnIssue: issue,
      },
    });
    if (updated.count !== 1) throw new Error("Nie można zgłosić problemu. Odśwież stronę.");
    if (preparedPhotos.length) {
      const existing = await tx.bookingEvidencePhoto.findMany({
        where: { bookingId, stage, uploaderId: userId }, select: { slot: true },
      });
      const freeSlots = [1, 2, 3].filter(slot => !existing.some(photo => photo.slot === slot));
      if (freeSlots.length < preparedPhotos.length) throw new Error("Możesz dodać najwyżej 3 zdjęcia na tym etapie.");
      await tx.bookingEvidencePhoto.createMany({
        data: preparedPhotos.map((photo, index) => ({ bookingId, stage, uploaderId: userId, slot: freeSlots[index], ...photo })),
      });
    }
  });
  await notifyLogisticsIssue(bookingId, stage, issue);
  revalidatePath("/bookings/" + bookingId);
  revalidatePath("/bookings");
}
