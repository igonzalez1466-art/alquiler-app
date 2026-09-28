import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { incidentState, incidentTimeline, incidentTopics } from "@/app/lib/incidentCase";

export const dynamic = "force-dynamic";
const datePL = (date: Date) => date.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "medium", timeStyle: "short" });

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/incidents");
  const userId = session.user.id;
  const rawPage = Number((await searchParams).page ?? "1");
  const requestedPage = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const where: Prisma.BookingWhereInput = {
    AND: [
      { OR: [{ ownerId: userId }, { renterId: userId }] },
      { OR: [
        { deliveryIssue: { not: Prisma.DbNull } },
        { returnIssue: { not: Prisma.DbNull } },
        { depositClaim: { not: Prisma.DbNull } },
        { deliveryConfirmationStatus: "DISPUTED" },
        { returnConfirmationStatus: "DISPUTED" },
      ] },
    ],
  };
  const total = await prisma.booking.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(requestedPage, pageCount);
  const bookings = await prisma.booking.findMany({
    where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20,
    select: {
      id: true, bookingNumber: true, createdAt: true, startDate: true, endDate: true, ownerId: true, renterId: true,
      status: true, deliveryIssue: true, returnIssue: true, depositClaim: true,
      deliveryConfirmationStatus: true, returnConfirmationStatus: true, depositStatus: true,
      depositDecisionAt: true, settlementCompletedAt: true, shippedAt: true, deliveredAt: true, deliveryConfirmedAt: true,
      returnShippedAt: true, returnDeliveredAt: true, returnConfirmedAt: true,
      depositRefundedAt: true, depositRetainedCents: true,
      listing: { select: { title: true } },
    },
  });

  return <main className="mx-auto max-w-4xl space-y-6 p-4">
    <Link href="/account" className="text-sm underline">← Mój profil</Link>
    <div>
      <h1 className="text-2xl font-bold">Moje incydenty</h1>
      <p className="mt-2 text-sm text-gray-600">Zgłoszenia dostawy, zwrotu i roszczenia dotyczące kaucji z Twoich rezerwacji. Daty podano w czasie polskim.</p>
    </div>
    <p className="text-sm text-gray-600">Sprawy: {total}</p>
    {bookings.length === 0 && <p className="rounded border bg-white p-5">Nie masz jeszcze zgłoszonych incydentów.</p>}
    <div className="space-y-4">
      {bookings.map(booking => {
        const state = incidentState(booking, userId);
        const lastEvent = incidentTimeline(booking).at(-1);
        return <article key={booking.id} className="rounded-xl border bg-white p-5 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-semibold">#{booking.bookingNumber} · {booking.listing.title}</h2><p className="text-xs text-gray-600">{booking.ownerId === userId ? "Właściciel" : "Najemca"} · {datePL(booking.startDate)} — {datePL(booking.endDate)}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${state.needsAction ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{state.label}</span>
          </div>
          <div className="flex flex-wrap gap-2">{incidentTopics(booking).map(topic => <span key={topic.label} className="rounded border px-2 py-1 text-xs">{topic.label}: {topic.detail}</span>)}</div>
          <p className="text-sm">{state.next}</p>
          {lastEvent && <p className="text-xs text-gray-600">Ostatni zapisany krok: {datePL(lastEvent.at)} · {lastEvent.title}</p>}
          <Link href={`/account/incidents/${encodeURIComponent(booking.id)}`} className="inline-flex rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Otwórz sprawę</Link>
        </article>;
      })}
    </div>
    <nav aria-label="Strony incydentów" className="flex justify-between text-sm">
      {page > 1 ? <Link className="underline" href={`?page=${page - 1}`}>← Poprzednia</Link> : <span />}
      {page < pageCount && <Link className="underline" href={`?page=${page + 1}`}>Następna →</Link>}
    </nav>
  </main>;
}
