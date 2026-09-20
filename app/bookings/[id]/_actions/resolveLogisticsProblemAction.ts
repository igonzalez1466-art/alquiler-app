"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import { receiptWhere } from "@/app/lib/logistics";
import { readIssue, type IssueDetails } from "@/app/lib/logisticsIssue";
import { tryInviteBookingReview } from "@/app/lib/reviewInvitations";

export async function resolveLogisticsProblemAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");
  const bookingId = String(formData.get("bookingId") || "");
  const stage = String(formData.get("stage") || "");
  if (!bookingId || (stage !== "DELIVERY" && stage !== "RETURN")) throw new Error("Nieprawidłowe zgłoszenie");
  if (formData.get("receivedAndResolved") !== "yes") {
    throw new Error("Potwierdź, że przedmiot został odebrany, a problem rozwiązany.");
  }

  const where = {
    ...receiptWhere(bookingId, userId, stage),
    ...(stage === "DELIVERY" ? { deliveryConfirmationStatus: "DISPUTED" as const } :
      { returnConfirmationStatus: "DISPUTED" as const }),
  };
  const booking = await prisma.booking.findFirst({
    where,
    select: { deliveryIssue: true, returnIssue: true },
  });
  if (!booking) throw new Error("Nie można zamknąć zgłoszenia. Odśwież stronę.");
  const stored = stage === "DELIVERY" ? booking.deliveryIssue : booking.returnIssue;
  const previous = readIssue(stored);
  // Legacy disputes had no metadata. Only the stage's recipient could open them.
  // Corrupt or mismatched metadata must instead be reviewed by support.
  if (stored !== null && (!previous || previous.reportedById !== userId || previous.resolvedAt !== null)) {
    throw new Error("Zgłoszenie wymaga wyjaśnienia z obsługą serwisu.");
  }
  const now = new Date();
  const issue: IssueDetails = {
    ...(previous ?? {
      reason: "LEGACY", description: "", reportedById: userId, reportedAt: null,
    }),
    resolvedById: userId,
    resolvedAt: now.toISOString(),
  };
  const updated = await prisma.booking.updateMany({
    where,
    data: stage === "DELIVERY" ? {
      deliveryIssue: issue,
      shippingStatus: "DELIVERED", deliveredAt: now,
      deliveryConfirmationStatus: "CONFIRMED", deliveryConfirmedAt: now,
      deliveryConfirmedBy: "RENTER", deliveryConfirmBy: null,
    } : {
      returnIssue: issue,
      returnStatus: "DELIVERED", returnDeliveredAt: now,
      returnConfirmationStatus: "CONFIRMED", returnConfirmedAt: now,
      returnConfirmedBy: "OWNER", returnConfirmBy: null,
    },
  });
  if (updated.count !== 1) throw new Error("Stan rezerwacji uległ zmianie. Odśwież stronę.");
  if (stage === "RETURN") await tryInviteBookingReview(bookingId);
  revalidatePath("/bookings/" + bookingId);
  revalidatePath("/bookings");
}
