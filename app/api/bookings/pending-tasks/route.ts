import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { pendingTasks } from "@/app/lib/pendingBookingTasks";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ tasks: [], total: 0 }, { status: 401, headers });
  try {
    const userId = session.user.id;
    const bookings = await prisma.booking.findMany({ where: { OR: [{ ownerId: userId }, { renterId: userId }], status: { not: "CANCELLED" }, cancelledAt: null, settlementCompletedAt: null },
      select: { id: true, bookingNumber: true, ownerId: true, renterId: true, status: true, paymentStatus: true, paymentDueAt: true, createdAt: true, startDate: true, endDate: true, cancelledAt: true,
        shippingStatus: true, deliveryConfirmationStatus: true, returnStatus: true, returnConfirmationStatus: true, returnConfirmedAt: true,
        depositStatus: true, depositCents: true, depositClaim: true, settlementDecision: true, settlementCompletedAt: true, deliveryIssue: true, returnIssue: true, settlementLegacyReview: true, depositDecisionAt: true, listing: { select: { title: true } } } });
    const tasks = pendingTasks(bookings, userId);
    return NextResponse.json({ tasks, total: tasks.length }, { headers });
  } catch {
    return NextResponse.json({ error: "Nie udało się pobrać zadań." }, { status: 503, headers });
  }
}
