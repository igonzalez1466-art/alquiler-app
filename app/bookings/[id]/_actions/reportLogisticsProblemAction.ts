"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import { receiptWhere } from "@/app/lib/logistics";

export async function reportLogisticsProblemAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");
  const bookingId = String(formData.get("bookingId") || "");
  const stage = String(formData.get("stage") || "");
  if (!bookingId || (stage !== "DELIVERY" && stage !== "RETURN")) throw new Error("Nieprawidłowe zgłoszenie");
  const updated = await prisma.booking.updateMany({
    where: receiptWhere(bookingId, userId, stage),
    data: stage === "DELIVERY" ? {
      deliveryConfirmationStatus: "DISPUTED", deliveryConfirmBy: null,
    } : {
      returnConfirmationStatus: "DISPUTED", returnConfirmBy: null,
    },
  });
  if (updated.count !== 1) throw new Error("Nie można zgłosić problemu. Odśwież stronę.");
  revalidatePath("/bookings/" + bookingId);
  revalidatePath("/bookings");
}
