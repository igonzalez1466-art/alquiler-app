import Link from "next/link";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { prisma } from "@/app/lib/prisma";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { readDepositClaim } from "@/app/lib/depositClaim";
import { readIssue, issueReasonLabel } from "@/app/lib/logisticsIssue";
import { disputeWhere, pageNumber, money, date, paymentLabels, depositLabels, type HistoryParams } from "@/app/lib/panelHistory";
import DepositClaimPanel from "@/app/bookings/[id]/_components/DepositClaimPanel";
export const dynamic = "force-dynamic";
function Incident({ title, stored, disputed }: { title: string; stored: Prisma.JsonValue | null; disputed: boolean }) {
  if (stored === null && !disputed) return null;
  const issue = readIssue(stored);
  return <div className="rounded border p-3 space-y-2 text-sm">
    <h4 className="font-semibold">{title} · {disputed ? "Otwarta" : issue?.resolvedAt ? "Rozwiązana" : "Historyczny zapis"}</h4>
    {issue ? <><p>Powód: {issueReasonLabel(issue.reason)}</p><p className="whitespace-pre-wrap break-words">{issue.description}</p>
      <p>Zgłoszono: {issue.reportedAt ? date(new Date(issue.reportedAt)) : "Brak daty w starszym zgłoszeniu"}</p>
      {issue.resolvedAt && <p>Rozwiązano: {date(new Date(issue.resolvedAt))}</p>}
    </> : <p>Starsza sprawa bez pełnych szczegółów. Zachowano dostępny status; brakujących danych nie można odtworzyć.</p>}
  </div>;
}
export default async function DepositClaimsPage({ searchParams }: { searchParams: Promise<HistoryParams> }) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) return notFound();
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN") return notFound();
  const p = await searchParams, where = disputeWhere(p), size = 20;
  const total = await prisma.booking.count({ where });
  const pages = Math.max(1, Math.ceil(total / size)), page = Math.min(pageNumber(p.page), pages);
  const bookings = await prisma.booking.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * size, take: size,
    select: { id: true, bookingNumber: true, createdAt: true, startDate: true, endDate: true, ownerId: true, renterId: true,
      owner: { select: { name: true, email: true } }, renter: { select: { name: true, email: true } },
      deliveryIssue: true, returnIssue: true, deliveryConfirmationStatus: true, returnConfirmationStatus: true, damageClaimStatus: true,
      depositClaim: true, depositCents: true, depositStatus: true, paymentStatus: true, rentAmountCents: true, platformFeeCents: true,
      depositRetainedCents: true, depositRefundedCents: true, depositRefundedAt: true, ownerTransferCents: true, ownerTransferId: true,
      depositTransferredCents: true, depositTransferId: true, settlementDecision: true, settlementCompletedAt: true, listing: { select: { title: true } } } });
  const url = (n: number) => "?" + new URLSearchParams({ booking: p.booking ?? "", state: p.state ?? "all", kind: p.kind ?? "all", page: String(n) });
  return <div className="space-y-5">
    <h2 className="text-xl font-semibold">Spory i zgłoszenia — historia</h2>
    <p>Sprawy dotyczące dostawy, zwrotu i kaucji, także zakończone i starsze. Każda pozycja grupuje zgłoszenia jednej rezerwacji.</p>
    <form className="flex flex-wrap gap-3 items-end rounded border p-3 text-sm">
      <label>Numer rezerwacji<input name="booking" defaultValue={p.booking} placeholder="np. 10075" className="block border rounded p-2 w-36" /></label>
      <label>Status<select name="state" defaultValue={p.state ?? "all"} className="block border rounded p-2"><option value="all">Wszystkie</option><option value="open">Otwarte / do rozliczenia</option><option value="closed">Archiwum</option></select></label>
      <label>Rodzaj<select name="kind" defaultValue={p.kind ?? "all"} className="block border rounded p-2"><option value="all">Wszystkie</option><option value="delivery">Dostawa</option><option value="return">Zwrot</option><option value="deposit">Kaucja</option></select></label>
      <button className="rounded border px-3 py-2">Filtruj</button><Link href="/admin/deposit-claims" className="underline">Wyczyść</Link>
    </form>
    <p className="text-sm">Rezerwacje ze zgłoszeniami: {total} · Strona {page} z {pages}</p>
    {!bookings.length && <p>Brak spraw dla wybranych filtrów.</p>}
    {bookings.map(b => {
      const involved = b.ownerId === session.user.id || b.renterId === session.user.id;
      return <section key={b.id} className="rounded border p-3 space-y-3">
        <h3 className="font-semibold">#{b.bookingNumber} · {b.listing.title}</h3>
        <p className="text-xs">Utworzono: {date(b.createdAt)} · Najem: {date(b.startDate)} — {date(b.endDate)}</p>
        <p className="text-sm break-words">Właściciel: {b.owner.name ?? "—"} · {b.owner.email ?? "—"}<br />Najemca: {b.renter.name ?? "—"} · {b.renter.email ?? "—"}</p>
        <Incident title="Dostawa" stored={b.deliveryIssue} disputed={b.deliveryConfirmationStatus === "DISPUTED"} />
        <Incident title="Zwrot" stored={b.returnIssue} disputed={b.returnConfirmationStatus === "DISPUTED"} />
        {involved && b.depositClaim !== null && !b.settlementCompletedAt && <p className="rounded bg-amber-50 p-2 text-sm">Jesteś stroną tej rezerwacji. Spór musi rozstrzygnąć inny administrator.</p>}
        {b.depositClaim !== null ? <DepositClaimPanel bookingId={b.id} depositCents={b.depositCents ?? 0} claim={readDepositClaim(b.depositClaim)} hasClaim
          isOwner={b.ownerId === session.user.id} isRenter={b.renterId === session.user.id} isSupport={!involved}
          completed={!!b.settlementCompletedAt} settling={!!b.settlementDecision} /> : b.damageClaimStatus !== "NONE" && <p>Starsze zgłoszenie dotyczące kaucji: {b.damageClaimStatus}. Brak zapisanej propozycji kwotowej.</p>}
        <details className="text-sm"><summary className="cursor-pointer font-medium">Płatności i rozliczenie</summary><dl className="mt-2 space-y-1">
          <div>Płatność: {paymentLabels[b.paymentStatus] ?? b.paymentStatus} · Kaucja: {depositLabels[b.depositStatus] ?? b.depositStatus}</div>
          <div>Najem: {money(b.rentAmountCents)} · Prowizja: {money(b.platformFeeCents)}</div>
          <div>Kaucja w rezerwacji: {money(b.depositCents)} · Zatrzymano: {money(b.depositRetainedCents)}</div>
          <div>Zwrot kaucji (status powyżej): {money(b.depositRefundedCents)} · {date(b.depositRefundedAt)}</div>
          <div>Transfer najmu: {money(b.ownerTransferId ? b.ownerTransferCents : null)} · Transfer kaucji: {money(b.depositTransferId ? b.depositTransferredCents : b.depositRetainedCents === 0 ? 0 : null)}</div>
          <div>Rozliczenie zapisano: {date(b.settlementCompletedAt)}</div>
        </dl></details>
      </section>;
    })}
    <nav aria-label="Strony sporów" className="flex justify-between">{page > 1 ? <Link className="underline" href={url(page - 1)}>← Poprzednia</Link> : <span />}{page < pages && <Link className="underline" href={url(page + 1)}>Następna →</Link>}</nav>
    <p className="text-xs text-gray-600">Daty w czasie polskim. Archiwum pokazuje zapisane dane; nie odtwarza historii usuniętej ani niezmigrowanej. Rozliczenie zapisane nie oznacza wpływu na rachunek bankowy.</p>
  </div>;
}
