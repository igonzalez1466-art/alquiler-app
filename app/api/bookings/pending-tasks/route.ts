import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { pendingTasks, type PendingTask } from "@/app/lib/pendingBookingTasks";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ tasks: [], total: 0 }, { status: 401, headers });
  try {
    const userId = session.user.id;
    const [user, bookings] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true, preferredInpostPointCode: true } }),
      prisma.booking.findMany({ where: { OR: [{ ownerId: userId }, { renterId: userId }], status: { not: "CANCELLED" }, cancelledAt: null, settlementCompletedAt: null },
      select: { id: true, bookingNumber: true, ownerId: true, renterId: true, status: true, paymentStatus: true, paymentDueAt: true, createdAt: true, startDate: true, endDate: true, cancelledAt: true,
        shippingStatus: true, deliveryConfirmationStatus: true, returnStatus: true, returnConfirmationStatus: true, returnConfirmedAt: true,
        depositStatus: true, depositCents: true, depositClaim: true, settlementDecision: true, settlementCompletedAt: true, deliveryIssue: true, returnIssue: true, settlementLegacyReview: true, depositDecisionAt: true, listing: { select: { title: true } } } }),
    ]);
    if (!user) return NextResponse.json({ tasks: [], total: 0 }, { status: 401, headers });
    const checkedAt = new Date();
    const profileTasks: PendingTask[] = [];
    if (!user.phone?.trim() || !user.phoneVerifiedAt) profileTasks.push({
      id: "profile:phone", bookingNumber: null, listing: null,
      title: "Zweryfikuj numer telefonu",
      description: "Dodaj i zweryfikuj numer telefonu, aby móc rezerwować i akceptować rezerwacje.",
      href: "/account#telefon", deadline: null, priority: 1,
    });
    if (!user.preferredInpostPointCode?.trim()) profileTasks.push({
      id: "profile:inpost", bookingNumber: null, listing: null,
      title: "Ustaw swój punkt InPost",
      description: "Dodaj kod punktu w sekcji „Mój punkt InPost”. Punkt dla konkretnej przesyłki potwierdzisz osobno w rezerwacji.",
      href: "/account#inpost", deadline: null, priority: 2,
    });
    const tasks = [...pendingTasks(bookings, userId, checkedAt), ...profileTasks].sort((a, b) => a.priority - b.priority || (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
    return NextResponse.json({ tasks, total: tasks.length, checkedAt: checkedAt.toISOString() }, { headers });
  } catch {
    return NextResponse.json({ error: "Nie udało się pobrać zadań." }, { status: 503, headers });
  }
}
