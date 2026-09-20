"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import { receiptWhere } from "@/app/lib/logistics";
import { validateIssueInput, type IssueDetails } from "@/app/lib/logisticsIssue";

export async function reportLogisticsProblemAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");
  const bookingId = String(formData.get("bookingId") || "");
  const stage = String(formData.get("stage") || "");
  if (!bookingId || (stage !== "DELIVERY" && stage !== "RETURN")) throw new Error("Nieprawidłowe zgłoszenie");
  const issue: IssueDetails = {
    ...validateIssueInput(formData),
    reportedById: userId,
    reportedAt: new Date().toISOString(),
    resolvedById: null,
    resolvedAt: null,
  };
  // Store the details and pause confirmation in the same atomic write.
  const updated = await prisma.booking.updateMany({
    where: receiptWhere(bookingId, userId, stage),
    data: stage === "DELIVERY" ? {
      deliveryConfirmationStatus: "DISPUTED", deliveryConfirmBy: null, deliveryIssue: issue,
    } : {
      returnConfirmationStatus: "DISPUTED", returnConfirmBy: null, returnIssue: issue,
    },
  });
  if (updated.count !== 1) throw new Error("Nie można zgłosić problemu. Odśwież stronę.");
  revalidatePath("/bookings/" + bookingId);
  revalidatePath("/bookings");
}
