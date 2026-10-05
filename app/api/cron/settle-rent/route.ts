import { sendPendingIncidentEmails } from "@/app/lib/incidentNotification";
import { Prisma } from "@prisma/client";
import { processRenterCancellation } from "@/app/lib/renterCancellation";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { settleRentOnlyBooking } from "@/app/lib/rentOnlySettlement";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("Unauthorized", { status: 401 });
  const bookings = await prisma.booking.findMany({ where: { paymentStatus: "PAID", cancelledAt: null, settlementCompletedAt: null, depositCents: 0, depositStatus: "NONE", OR: [{ deliveryConfirmationStatus: "CONFIRMED", deliveryConfirmedAt: { not: null } }, { incidents: { some: { stage: "DELIVERY", status: "AGREEMENT_REACHED" } } }] }, select: { id: true }, take: 5, orderBy: { paidAt: "asc" } });
  const results = [];
  for (const b of bookings) {
    try { results.push({ id: b.id, completed: await settleRentOnlyBooking(b.id) }); }
    catch { results.push({ id: b.id, completed: false }); }
  }
  const cancellations = await prisma.booking.findMany({ where: { status: "CANCELLED", renterCancellation: { not: Prisma.DbNull }, OR: [
    { renterCancellation: { path: ["status"], equals: "PENDING" } },
    { renterCancellation: { path: ["notifications", "owner", "sentAt"], equals: Prisma.JsonNull } },
    { renterCancellation: { path: ["notifications", "renter", "sentAt"], equals: Prisma.JsonNull } },
  ] }, select: { id: true }, take: 5, orderBy: { cancelledAt: "asc" } });
  for (const b of cancellations) {
    try { results.push({ id: b.id, completed: ["NONE", "SUCCEEDED"].includes(await processRenterCancellation(b.id) ?? "") }); }
    catch { results.push({ id: b.id, completed: false }); }
  }
  await sendPendingIncidentEmails();
  return NextResponse.json({ results });
}
