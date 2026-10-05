"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authConfig } from "@/auth.config";
import { prisma } from "@/app/lib/prisma";
import { reasonsForStage, validateIncidentReason, incidentRequiresPhotos, REQUIRED_INCIDENT_PHOTOS_MESSAGE } from "@/app/lib/incidentPolicy";
import { prepareBookingEvidencePhotoFiles } from "@/app/lib/bookingEvidencePhotoFiles";
import { trySettleRentOnlyBooking } from "@/app/lib/rentOnlySettlement";

async function user() {
  const id = (await getServerSession(authConfig))?.user?.id;
  if (!id) throw new Error("Brak dostępu.");
  return id;
}
function refresh(id: string) {
  for (const p of [`/bookings/${id}`, "/bookings", `/account/incidents/${id}`, "/account/incidents", "/account"]) revalidatePath(p);
}
function description(data: FormData, field: string) {
  const text = String(data.get(field) ?? "").trim();
  if (!text || text.length > 2000) throw new Error("Podaj opis od 1 do 2000 znaków.");
  return text;
}
export async function openIncidentAction(data: FormData) {
  const userId = await user();
  const bookingId = String(data.get("bookingId") ?? "");
  const stage = String(data.get("stage"));
  if (!(stage in reasonsForStage) || (stage !== "DELIVERY" && stage !== "RETURN")) throw new Error("Nieprawidłowy etap.");
  const reason = validateIncidentReason(stage, String(data.get("reason")));
  const text = description(data, "description");
  const files = data.getAll("photos").filter((v): v is File => v instanceof File && v.size > 0);
  if (files.length > 3) throw new Error("Maksymalnie 3 zdjęcia.");
  if (incidentRequiresPhotos(stage, reason) && files.length === 0) throw new Error(REQUIRED_INCIDENT_PHOTOS_MESSAGE);
  const photos = await prepareBookingEvidencePhotoFiles(files);
  if (incidentRequiresPhotos(stage, reason) && photos.length === 0) throw new Error(REQUIRED_INCIDENT_PHOTOS_MESSAGE);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
    const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (b.paymentStatus !== "PAID" || b.status === "CANCELLED" || b.cancelledAt ||
      userId !== (stage === "DELIVERY" ? b.renterId : b.ownerId)) throw new Error("Nie można otworzyć tego zgłoszenia.");
    // Receipt is the irreversible financial boundary. No return incident can reduce earned rent.
    if (stage === "DELIVERY" && (b.deliveryConfirmedAt || ["CONFIRMED", "AUTO_CONFIRMED"].includes(b.deliveryConfirmationStatus) || b.rentSettlement || b.ownerTransferId)) {
      throw new Error("Odbiór został już potwierdzony. Najem nie jest już gwarancją.");
    }
    if (stage === "RETURN" && !["CONFIRMED", "AUTO_CONFIRMED"].includes(b.deliveryConfirmationStatus)) throw new Error("Najpierw potwierdź dostawę.");
    if (reason === "NOT_SHIPPED" && b.shippedAt) throw new Error("Przedmiot oznaczono już jako wysłany.");
    if ((reason === "NOT_RETURNED" || reason === "LATE_RETURN") && new Date() < b.endDate) throw new Error("Termin zwrotu jeszcze nie upłynął.");
    const incident = await tx.incident.create({ data: {
      bookingId, stage, reason, description: text, openedById: userId,
      againstUserId: stage === "DELIVERY" ? b.ownerId : b.renterId,
      status: stage === "DELIVERY" ? "AWAITING_OWNER" : "AWAITING_RENTER",
    } });
    const now = new Date();
    const issue = { reason: reason === "DAMAGED_ON_ARRIVAL" || reason === "DAMAGED_ON_RETURN" ? "DAMAGED" : reason === "NOT_AS_DESCRIBED" ? "WRONG_ITEM" : reason === "RETURN_NOT_RECEIVED" || reason === "NOT_RETURNED" || reason === "NOT_SHIPPED" ? "NOT_RECEIVED" : reason,
      description: text, reportedById: userId, reportedAt: now.toISOString(), resolvedById: null, resolvedAt: null };
    await tx.booking.update({ where: { id: bookingId }, data: stage === "DELIVERY" ?
      { deliveryConfirmationStatus: "DISPUTED", deliveryConfirmBy: null, deliveryIssue: issue } :
      { returnConfirmationStatus: "DISPUTED", returnConfirmBy: null, returnIssue: issue } });
    const tracking = stage === "DELIVERY" ? b.trackingNumber : b.returnTrackingNumber;
    if (tracking) await tx.incidentEvidence.create({ data: { incidentId: incident.id, uploaderId: userId, text: `Numer przesyłki przy zgłoszeniu: ${tracking}` } });
    const existing = await tx.bookingEvidencePhoto.findMany({ where: { bookingId, stage, uploaderId: userId }, select: { slot: true } });
    const slots = [1, 2, 3].filter(slot => !existing.some(p => p.slot === slot));
    if (slots.length < photos.length) throw new Error("Limit zdjęć dla tego etapu został wykorzystany.");
    if (photos.length) await tx.bookingEvidencePhoto.createMany({ data: photos.map((p, i) => ({ ...p, bookingId, stage, uploaderId: userId, slot: slots[i] })) });
  });
  refresh(bookingId);
}
export async function incidentAction(data: FormData) {
  const userId = await user();
  const bookingId = String(data.get("bookingId") ?? "");
  const incidentId = String(data.get("incidentId") ?? "");
  const operation = String(data.get("operation"));
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
    const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const inc = await tx.incident.findUniqueOrThrow({ where: { id: incidentId } });
    if (inc.bookingId !== bookingId || ![b.ownerId, b.renterId].includes(userId)) throw new Error("Brak dostępu.");
    if (operation === "evidence") {
      if (inc.status === "RESOLVED") throw new Error("Sprawa zakończona.");
      await tx.incidentEvidence.create({ data: { incidentId, uploaderId: userId, text: description(data, "evidence") } });
      return;
    }
    if (operation === "propose") {
      if (userId !== (inc.stage === "DELIVERY" ? b.ownerId : inc.againstUserId) ||
        !["OPEN", "AWAITING_OWNER", "AWAITING_RENTER", "ESCALATED"].includes(inc.status) || inc.acceptedAt || b.rentSettlement && inc.stage === "DELIVERY") throw new Error("Nie można zmienić tej propozycji.");
      const raw = String(data.get("refundCents") ?? "0");
      const refundCents = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(refundCents) || refundCents < 0 ||
        refundCents > (b.rentAmountCents ?? b.amountCents ?? 0) || inc.stage === "RETURN" && refundCents !== 0) throw new Error("Nieprawidłowa kwota zwrotu.");
      if (inc.stage === "DELIVERY" && (b.depositCents ?? 0) > 0) throw new Error("Historyczna płatność z kaucją wymaga osobnego rozliczenia.");
      await tx.incidentEvidence.create({ data: { incidentId, uploaderId: userId, text: `Propozycja: ${description(data, "resolution")} · Zwrot najmu: ${refundCents} gr` } });
      await tx.incident.update({ where: { id: incidentId }, data: { refundCents, resolution: description(data, "resolution"), proposedById: userId, proposedAt: new Date(), status: inc.stage === "DELIVERY" ? "AWAITING_RENTER" : "AWAITING_OWNER" } });
      return;
    }
    if (operation === "accept" || operation === "reject") {
      if (!inc.proposedById || inc.proposedById === userId || !["AWAITING_OWNER", "AWAITING_RENTER"].includes(inc.status) || inc.acceptedAt) throw new Error("Brak propozycji do zaakceptowania.");
      if (operation === "accept" && inc.stage === "DELIVERY" && (inc.refundCents ?? 0) < (b.rentAmountCents ?? 0) && data.get("receivedAndAccepted") !== "yes") throw new Error("Potwierdź odbiór i akceptację dalszego najmu.");
      await tx.incident.update({ where: { id: incidentId }, data: operation === "reject" ?
        { status: "ESCALATED" } : { status: inc.stage === "DELIVERY" ? "AGREEMENT_REACHED" : "RESOLVED", acceptedAt: new Date(), ...(inc.stage === "RETURN" ? { resolvedAt: new Date() } : {}) } });
      await tx.incidentEvidence.create({ data: { incidentId, uploaderId: userId, text: operation === "accept" ? "Zaakceptowano propozycję." : "Odrzucono propozycję — sprawa wymaga wyjaśnienia." } });
      if (operation === "accept" && inc.stage === "RETURN") {
        // Closing a return case does not assert receipt of a missing item.
        const issue = b.returnIssue;
        if (issue && typeof issue === "object" && !Array.isArray(issue)) await tx.booking.update({ where: { id: bookingId }, data: { returnIssue: { ...issue, resolvedAt: new Date().toISOString(), resolvedById: userId } } });
      }
      return;
    }
    if (operation === "escalate" && !["RESOLVED", "AGREEMENT_REACHED"].includes(inc.status)) {
      await tx.incident.update({ where: { id: incidentId }, data: { status: "ESCALATED" } });
      return;
    }
    if (operation !== "retry" || inc.stage !== "DELIVERY" || inc.status !== "AGREEMENT_REACHED") throw new Error("Nieprawidłowa operacja.");
  });
  await trySettleRentOnlyBooking(bookingId);
  refresh(bookingId);
}
