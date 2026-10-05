import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { incidentBucket, incidentState, incidentTimeline, incidentTopics, type IncidentBucket } from "@/app/lib/incidentCase";

export const dynamic = "force-dynamic";
const datePL = (date: Date) => date.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "medium", timeStyle: "short" });

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ page?: string; state?: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/incidents");
  const userId = session.user.id;
  const params = await searchParams;
  const filter = (["action", "waiting", "closed"] as const).find(value => value === params.state) ?? "all";
  const rawPage = Number(params.page ?? "1");
  const requestedPage = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const where: Prisma.BookingWhereInput = {
    AND: [
      { OR: [{ ownerId: userId }, { renterId: userId }] },
      { OR: [
        { incidents: { some: {} } },
        { deliveryIssue: { not: Prisma.DbNull } },
        { returnIssue: { not: Prisma.DbNull } },
        { depositClaim: { not: Prisma.DbNull } },
        { deliveryConfirmationStatus: "DISPUTED" },
        { returnConfirmationStatus: "DISPUTED" },
      ] },
    ],
  };
  const bookings = await prisma.booking.findMany({
    where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true, bookingNumber: true, createdAt: true, startDate: true, endDate: true, ownerId: true, renterId: true,
      status: true, deliveryIssue: true, returnIssue: true, depositClaim: true,
      deliveryConfirmationStatus: true, returnConfirmationStatus: true, depositStatus: true,
      depositDecisionAt: true, settlementCompletedAt: true, shippedAt: true, deliveredAt: true, deliveryConfirmedAt: true,
      returnShippedAt: true, returnDeliveredAt: true, returnConfirmedAt: true,
      depositRefundedAt: true, depositRetainedCents: true, depositCents: true,
      incidents: true,
      listing: { select: { title: true } },
    },
  });
  const cards = bookings.map(booking => ({ booking, state: incidentState(booking, userId), bucket: incidentBucket(booking, userId), lastEvent: incidentTimeline(booking).at(-1) }));
  const order: Record<IncidentBucket, number> = { action: 0, waiting: 1, closed: 2 };
  cards.sort((a, b) => order[a.bucket] - order[b.bucket] || (b.lastEvent?.at.getTime() ?? b.booking.createdAt.getTime()) - (a.lastEvent?.at.getTime() ?? a.booking.createdAt.getTime()));
  const counts = { action: cards.filter(card => card.bucket === "action").length, waiting: cards.filter(card => card.bucket === "waiting").length, closed: cards.filter(card => card.bucket === "closed").length };
  const filtered = filter === "all" ? cards : cards.filter(card => card.bucket === filter);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const page = Math.min(requestedPage, pageCount);
  const visible = filtered.slice((page - 1) * 20, page * 20);
  const filterHref = (value: string) => value === "all" ? "/account/incidents" : `/account/incidents?state=${value}`;
  const pageHref = (value: number) => `?${new URLSearchParams({ ...(filter === "all" ? {} : { state: filter }), page: String(value) })}`;

  return <main className="mx-auto max-w-4xl space-y-6 p-4">
    <Link href="/account" className="text-sm underline">← Mój profil</Link>
    <div>
      <h1 className="text-2xl font-bold">Moje incydenty</h1>
      <p className="mt-2 text-sm text-gray-600">Zgłoszenia dotyczące dostawy i zwrotu z Twoich rezerwacji. Historyczne roszczenia dotyczące kaucji również pozostają dostępne. Daty podano w czasie polskim.</p>
    </div>
    <nav aria-label="Filtruj incydenty" className="flex flex-wrap gap-2 text-sm">
      {([
        ["all", "Wszystkie", cards.length],
        ["action", "Wymaga Twojego działania", counts.action],
        ["waiting", "Oczekuje na kolejny krok", counts.waiting],
        ["closed", "Zakończone", counts.closed],
      ] as const).map(([value, label, count]) => <Link key={value} href={filterHref(value)} aria-current={filter === value ? "page" : undefined} className={`rounded-full border px-3 py-2 ${filter === value ? "border-indigo-600 bg-indigo-600 text-white" : "bg-white text-gray-800 hover:border-indigo-400"}`}>{label} · {count}</Link>)}
    </nav>
    {visible.length === 0 && <p className="rounded border bg-white p-5">{cards.length === 0 ? "Nie masz jeszcze zgłoszonych incydentów." : "Brak spraw w tej grupie."}</p>}
    <div className="space-y-4">
      {visible.map(({ booking, state, bucket, lastEvent }) => {
        return <article key={booking.id} className="rounded-xl border bg-white p-5 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-semibold">#{booking.bookingNumber} · {booking.listing.title}</h2><p className="text-xs text-gray-600">{booking.ownerId === userId ? "Właściciel" : "Najemca"} · {datePL(booking.startDate)} — {datePL(booking.endDate)}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bucket === "action" ? "bg-amber-100 text-amber-900" : bucket === "waiting" ? "bg-blue-100 text-blue-900" : "bg-slate-100 text-slate-700"}`}>{state.label}</span>
          </div>
          <div className="flex flex-wrap gap-2">{incidentTopics(booking).map(topic => <span key={topic.label} className="rounded border px-2 py-1 text-xs">{topic.label}: {topic.detail}</span>)}</div>
          <p className="text-sm">{state.next}</p>
          {lastEvent && <p className="text-xs text-gray-600">Ostatni zapisany krok: {datePL(lastEvent.at)} · {lastEvent.title}</p>}
          <Link href={`/account/incidents/${encodeURIComponent(booking.id)}`} className="inline-flex rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Otwórz sprawę</Link>
        </article>;
      })}
    </div>
    <nav aria-label="Strony incydentów" className="flex justify-between text-sm">
      {page > 1 ? <Link className="underline" href={pageHref(page - 1)}>← Poprzednia</Link> : <span />}
      {page < pageCount && <Link className="underline" href={pageHref(page + 1)}>Następna →</Link>}
    </nav>
  </main>;
}
