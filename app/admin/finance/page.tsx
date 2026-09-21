import Link from "next/link";
import Stripe from "stripe";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { financeTab, financeCursor, currencyAmount, stripeFinanceRows } from "@/app/lib/stripeFinance";
export const dynamic = "force-dynamic";
export const revalidate = 0;
type Params = { tab?: string; days?: string; after?: string };
export default async function StripeFinancePage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/finance");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN") notFound();
  const p = await searchParams, tab = financeTab(p.tab), days = p.days === "all" ? null : p.days === "7" ? 7 : p.days === "90" ? 90 : 30;
  const cursor = financeCursor(p.after, tab);
  const href = (nextTab = tab, after?: string) => "/admin/finance?" + new URLSearchParams({ tab: nextTab, days: days === null ? "all" : String(days), ...(after ? { after } : {}) });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return <div className="space-y-3"><h2 className="text-xl font-semibold">Finanse Stripe</h2><p role="alert">Brak konfiguracji Stripe w tym środowisku. Ustaw klucz serwerowy STRIPE_SECRET_KEY w ustawieniach wdrożenia.</p></div>;
  const stripe = new Stripe(key, { apiVersion: "2025-09-30.clover", timeout: 10000, maxNetworkRetries: 1 });
  const [balanceResult, rowsResult] = await Promise.allSettled([stripe.balance.retrieve(), stripeFinanceRows(stripe, tab, days, cursor)]);
  const balance = balanceResult.status === "fulfilled" ? balanceResult.value : null;
  const activity = rowsResult.status === "fulfilled" ? rowsResult.value : null;
  const checkedAt = new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
  const references = activity?.rows.flatMap(r => r.references) ?? [];
  const ids = activity?.rows.flatMap(r => r.bookingId ? [r.bookingId] : []) ?? [];
  const bookingRefs = references.length || ids.length ? await prisma.booking.findMany({ where: { OR: [{ id: { in: ids } }, { depositPaymentIntentId: { in: references } }, { depositChargeId: { in: references } }, { depositRefundId: { in: references } }, { ownerTransferId: { in: references } }, { depositTransferId: { in: references } }, { paymentRef: { in: references } }] }, select: { id: true, bookingNumber: true, depositPaymentIntentId: true, depositChargeId: true, depositRefundId: true, ownerTransferId: true, depositTransferId: true, paymentRef: true }, take: 100 }) : [];
  const related = (row: NonNullable<typeof activity>["rows"][number]) => bookingRefs.find(b => b.id === row.bookingId || [b.depositPaymentIntentId, b.depositChargeId, b.depositRefundId, b.ownerTransferId, b.depositTransferId, b.paymentRef].some(id => id && row.references.includes(id)));
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">Finanse Stripe</h2><form action="/admin/finance" method="get"><input type="hidden" name="tab" value={tab} /><input type="hidden" name="days" value={days === null ? "all" : String(days)} />{cursor && <input type="hidden" name="after" value={cursor} />}<button className="rounded border px-3 py-1">Odśwież dane</button></form></div>
    <p className="text-sm">Dane bezpośrednio ze Stripe · {checkedAt} (czas polski). Konto platformy MojaSzafa.</p>
    <p className="rounded border p-3 font-semibold">{balance ? balance.livemode ? "Tryb rzeczywisty — prawdziwe środki" : "Tryb testowy / sandbox — środki testowe" : "Nie udało się potwierdzić trybu Stripe"}</p>
    {balance ? <div className="grid sm:grid-cols-2 gap-3">{[["Saldo dostępne", balance.available], ["Saldo oczekujące", balance.pending]].map(([label, values]) => <section key={String(label)} className="rounded border p-3"><h3 className="font-semibold">{String(label)}</h3>{(values as Stripe.Balance.Available[]).length ? (values as Stripe.Balance.Available[]).map(v => <p key={v.currency}>{currencyAmount(v.amount, v.currency)}</p>) : <p>Brak pozycji salda</p>}</section>)}</div> : <p role="alert" className="text-rose-800">Nie udało się pobrać salda. Sprawdź dostęp do Stripe i spróbuj ponownie.</p>}
    <p className="text-xs text-gray-600">Saldo jest aktualnym stanem konta, niezależnym od filtra dat. Nie oznacza zysku platformy ani sumy środków na kontach właścicieli.</p>
    <nav className="flex flex-wrap gap-2" aria-label="Rodzaj operacji">{([['payments','Płatności'],['refunds','Zwroty'],['transfers','Transfery'],['balance','Ruchy salda i opłaty']] as const).map(([value,label]) => <Link prefetch={false} key={value} href={href(value)} aria-current={tab === value ? "page" : undefined} className={`rounded border px-3 py-2 ${tab === value ? "bg-indigo-600 text-white" : ""}`}>{label}</Link>)}</nav>
    <form className="flex gap-3 items-end"><input type="hidden" name="tab" value={tab} /><label>Okres<select name="days" defaultValue={days === null ? "all" : String(days)} className="block rounded border p-2"><option value="7">Ostatnie 7 dni</option><option value="30">Ostatnie 30 dni</option><option value="90">Ostatnie 90 dni</option><option value="all">Cała historia</option></select></label><button className="rounded border px-3 py-2">Pokaż</button></form>
    {tab === "balance" && <p className="text-sm">Kwoty ze znakiem pokazują wpływ na saldo platformy. Netto = kwota − opłata Stripe. Status oznacza dostępność środków, a nie status rezerwacji.</p>}
    {!activity ? <p role="alert" className="text-rose-800">Nie udało się pobrać operacji. Odśwież stronę; sprawdź również uprawnienia klucza Stripe. Brak odpowiedzi nie oznacza braku transakcji.</p> : <>
      <p className="text-sm">Wyświetlono {activity.rows.length} operacji. Kolejne strony udostępniają starsze wpisy.</p>
      {!activity.rows.length && <p>Brak operacji w wybranym okresie.</p>}
      <div className="space-y-3">{activity.rows.map(row => { const booking = related(row); return <article key={row.id} className="rounded border p-3 space-y-2 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{row.kind} · {currencyAmount(row.amount,row.currency)}</h3><span>{row.status}</span></div>
        <p>{new Date(row.created * 1000).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>
        {row.fee !== null && row.net !== null && <p>Opłata Stripe: {currencyAmount(row.fee,row.currency)} · Netto: {currencyAmount(row.net,row.currency)}</p>}
        {!!row.returned && <p>{tab === "transfers" ? "Cofnięto" : "Zwrócono"}: {currencyAmount(row.returned,row.currency)}</p>}
        <p>Rezerwacja: {booking ? `#${booking.bookingNumber}` : row.bookingNumber ? `#${row.bookingNumber} (metadane Stripe)` : "Brak powiązania"}</p>
        {row.destination && <p className="break-all">Konto odbiorcy: {row.destination}</p>}
        <details><summary className="cursor-pointer">Identyfikatory Stripe</summary><p className="break-all">{row.id}</p>{row.references.filter(ref => ref !== row.id).map(ref => <p className="break-all" key={ref}>{ref}</p>)}</details>
      </article>; })}</div>
      <nav className="flex justify-between" aria-label="Strony operacji">{cursor ? <Link href={href()} prefetch={false} className="underline">← Najnowsze</Link> : <span />}{activity.hasMore && activity.rows.length > 0 && <Link href={href(tab,activity.rows.at(-1)!.id)} prefetch={false} className="underline">Starsze →</Link>}</nav>
    </>}
    <p className="text-xs text-gray-600">Transfer potwierdza przekazanie na saldo Stripe odbiorcy, nie wypłatę bankową. Zwrot oznaczony jako zakończony przez Stripe może jeszcze oczekiwać na zaksięgowanie w banku. Panel służy wyłącznie do odczytu.</p>
  </div>;
}
