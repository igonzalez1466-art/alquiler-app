import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { transactionWhere, pageNumber, financialRows, money, date, paymentLabels, depositLabels, type HistoryParams } from "@/app/lib/panelHistory";
export const dynamic = "force-dynamic";
export default async function TransactionHistoryPage({ searchParams }: { searchParams: Promise<HistoryParams> }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/transactions");
  const userId = session.user.id, p = await searchParams, where = transactionWhere(userId, p), size = 20;
  const total = await prisma.booking.count({ where });
  const pages = Math.max(1, Math.ceil(total / size)), page = Math.min(pageNumber(p.page), pages);
  const bookings = await prisma.booking.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * size, take: size,
    select: { id: true, bookingNumber: true, ownerId: true, renterId: true, createdAt: true, startDate: true, endDate: true, status: true,
      paymentStatus: true, paidAt: true, refundedAt: true, rentAmountCents: true, depositCents: true, depositStatus: true, depositPaidAt: true,
      depositRefundedCents: true, depositRetainedCents: true, depositRefundedAt: true, platformFeeCents: true, ownerPayoutCents: true,
      ownerTransferId: true, ownerTransferCents: true, ownerTransferredAt: true, depositTransferId: true, depositTransferredCents: true, depositTransferredAt: true,
      settlementCompletedAt: true, depositClaim: true, deliveryConfirmationStatus: true, returnConfirmationStatus: true, listing: { select: { title: true } } } });
  const url = (n: number) => "?" + new URLSearchParams({ booking: p.booking ?? "", role: p.role ?? "all", state: p.state ?? "all", page: String(n) });
  return <main className="mx-auto max-w-4xl space-y-5 p-4">
    <Link href="/account" className="underline">← Moje konto</Link>
    <h1 className="text-2xl font-bold">Historia transakcji</h1>
    <p>Historia płatności i rozliczeń według rezerwacji. Daty podano w czasie polskim.</p>
    <form className="flex flex-wrap gap-3 items-end rounded border p-3 bg-white">
      <label>Numer rezerwacji<input name="booking" defaultValue={p.booking} placeholder="np. 10075" className="block border rounded p-2" /></label>
      <label>Moja rola<select name="role" defaultValue={p.role ?? "all"} className="block border rounded p-2"><option value="all">Wszystkie</option><option value="owner">Właściciel</option><option value="renter">Najemca</option></select></label>
      <label>Rozliczenie<select name="state" defaultValue={p.state ?? "all"} className="block border rounded p-2"><option value="all">Wszystkie</option><option value="pending">Niezakończone</option><option value="settled">Zapisane</option></select></label>
      <button className="rounded border px-4 py-2">Filtruj</button><Link href="/account/transactions" className="underline">Wyczyść</Link>
    </form>
    <p className="text-sm">Rezerwacje: {total} · Strona {page} z {pages}</p>
    {!bookings.length && <p>Brak rezerwacji dla wybranych filtrów.</p>}
    {bookings.map(b => <article key={b.id} className="rounded border bg-white p-4 space-y-3">
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">#{b.bookingNumber} · {b.listing.title}</h2><Link className="underline" href={`/bookings/${b.id}`}>Szczegóły rezerwacji</Link></div>
      <p className="text-sm">{b.ownerId === userId ? "Właściciel" : "Najemca"} · {date(b.startDate)} — {date(b.endDate)}{b.status === "CANCELLED" ? " · Rezerwacja anulowana" : ""}</p>
      <div className="flex flex-wrap gap-2 text-sm"><span className="rounded border px-2 py-1">Płatność: {paymentLabels[b.paymentStatus] ?? b.paymentStatus}</span><span className="rounded border px-2 py-1">Kaucja: {depositLabels[b.depositStatus] ?? b.depositStatus}</span></div>
      {(b.deliveryConfirmationStatus === "DISPUTED" || b.returnConfirmationStatus === "DISPUTED") && <p className="text-rose-800">Otwarta sprawa — sprawdź szczegóły rezerwacji.</p>}
      <dl className="grid gap-2 text-sm">{financialRows(b, userId).map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b pb-1"><dt>{label}</dt><dd className="font-medium whitespace-nowrap">{money(value)}</dd></div>)}</dl>
      <details className="text-sm"><summary className="cursor-pointer">Daty płatności i rozliczenia</summary><dl className="mt-2 space-y-1">
        <div>Utworzono rezerwację: {date(b.createdAt)}</div><div>Płatność: {date(b.paidAt)}</div><div>Wpłata kaucji: {date(b.depositPaidAt)}</div>
        <div>Zwrot kaucji: {date(b.depositRefundedAt)}</div>{b.refundedAt && <div>Zwrot płatności: {date(b.refundedAt)}</div>}
        {b.ownerId === userId && <><div>Transfer za najem: {date(b.ownerTransferredAt)}</div><div>Transfer kaucji: {date(b.depositTransferredAt)}</div></>}
        <div>Zapisano rozliczenie: {date(b.settlementCompletedAt)}</div>
      </dl></details>
    </article>)}
    <nav aria-label="Strony historii" className="flex justify-between">{page > 1 ? <Link className="underline" href={url(page - 1)}>← Poprzednia</Link> : <span />}{page < pages && <Link className="underline" href={url(page + 1)}>Następna →</Link>}</nav>
    <p className="text-xs text-gray-600">Brak danych oznacza brak zapisanego historycznej kwoty lub potwierdzenia operacji. Kwoty rezerwacji nie oznaczają pobranej płatności — sprawdź jej status. Transfer na saldo Stripe właściciela i wypłata na jego rachunek bankowy są osobnymi etapami. Potwierdzony zwrot może być jeszcze przetwarzany przez bank.</p>
  </main>;
}
