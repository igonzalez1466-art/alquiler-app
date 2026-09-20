"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import { receiptWhere } from "@/app/lib/logistics";
import { tryInviteBookingReview } from "@/app/lib/reviewInvitations";

export async function confirmReturnAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");
  const bookingId = String(formData.get("bookingId") || "");
  if (!bookingId) throw new Error("Brak bookingId");
  const now = new Date();
  const updated = await prisma.booking.updateMany({
    where: receiptWhere(bookingId, userId, "RETURN"),
    data: {
      returnStatus: "DELIVERED",
      returnDeliveredAt: now,
      returnConfirmationStatus: "CONFIRMED",
      returnConfirmedAt: now,
      returnConfirmedBy: "OWNER",
      returnConfirmBy: null,
    },
  });
  if (updated.count !== 1) throw new Error("Nie można potwierdzić odbioru. Odśwież stronę.");
  await tryInviteBookingReview(bookingId);
  revalidatePath("/bookings/" + bookingId);
  revalidatePath("/bookings");
}
