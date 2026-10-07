import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { helpBookingSummary } from "@/app/lib/helpBooking";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const select = {
  id: true, bookingNumber: true, ownerId: true, renterId: true, status: true, paymentStatus: true, paymentDueAt: true, createdAt: true, startDate: true, endDate: true, cancelledAt: true,
  shippingStatus: true, deliveryConfirmationStatus: true, returnStatus: true, returnConfirmationStatus: true, returnConfirmedAt: true,
  depositStatus: true, depositCents: true, depositClaim: true, settlementDecision: true, settlementCompletedAt: true, deliveryIssue: true, returnIssue: true, settlementLegacyReview: true, depositDecisionAt: true,
  carrier: true, trackingNumber: true, returnCarrier: true, returnTrackingNumber: true,
  incidents: { select: { stage: true, status: true, reason: true, acceptedAt: true, refundCents: true }, orderBy: { createdAt: "desc" } }, listing: { select: { title: true } },
} satisfies Prisma.BookingSelect;
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) return NextResponse.json({ error: "Zaloguj się, aby zobaczyć swoje rezerwacje." }, { status: 401, headers });
    const userId = session.user.id;
    const id = new URL(request.url).searchParams.get("id");
    if (id !== null && !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return NextResponse.json({ error: "Nieprawidłowa rezerwacja." }, { status: 400, headers });
    const bookings = await prisma.booking.findMany({ where: { OR: [{ ownerId: userId }, { renterId: userId }], ...(id ? { id } : {}) }, select, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: id ? 1 : 31 });
    if (id && !bookings.length) return NextResponse.json({ error: "Rezerwacja nie jest dostępna." }, { status: 404, headers });
    return NextResponse.json({ bookings: bookings.slice(0,30).map(b => helpBookingSummary(b, userId)), hasMore: bookings.length > 30, checkedAt: new Date().toISOString() }, { headers });
  } catch {
    return NextResponse.json({ error: "Nie udało się pobrać rezerwacji. Spróbuj ponownie." }, { status: 503, headers });
  }
}
