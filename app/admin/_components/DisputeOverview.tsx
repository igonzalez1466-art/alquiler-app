import Link from "next/link";
import { prisma } from "@/app/lib/prisma";
import { disputeWhere } from "@/app/lib/panelHistory";

export default async function DisputeOverview() {
  const stages = [
    { kind: "delivery", title: "Zgłoszenia najemców", description: "Problemy przy odbiorze przedmiotu od właściciela." },
    { kind: "return", title: "Zgłoszenia właścicieli", description: "Problemy przy odbiorze zwrotu od najemcy." },
  ];
  const counts = await Promise.all(stages.map(async stage => {
    const [total, open] = await Promise.all([
      prisma.booking.count({ where: disputeWhere({ kind: stage.kind }) }),
      prisma.booking.count({ where: disputeWhere({ kind: stage.kind, state: "open" }) }),
    ]);
    return { ...stage, total, open };
  }));
  const [disputed, awaitingRenter] = await Promise.all([
    prisma.booking.count({ where: { depositClaim: { path: ["status"], equals: "DISPUTED" }, settlementCompletedAt: null } }),
    prisma.booking.count({ where: { depositClaim: { path: ["status"], equals: "PENDING" }, settlementCompletedAt: null } }),
  ]);
  return <section className="space-y-3" aria-labelledby="dispute-overview-title">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="dispute-overview-title" className="text-lg font-semibold">Zgłoszenia i spory</h2>
      <Link className="text-sm underline" href="/admin/deposit-claims">Cała historia →</Link>
    </div>
    <p className="text-xs text-gray-600">Stan bieżący i cała historia — niezależnie od zakresu 7 / 30 / 90 dni wykresów. Jedna rezerwacja może mieć osobne zgłoszenie dostawy i zwrotu.</p>
    <div className="grid gap-3 lg:grid-cols-2">{counts.map(stage => <article key={stage.kind} className="rounded-lg border bg-white p-4 space-y-3">
      <h3 className="font-semibold">{stage.title}</h3><p className="text-sm text-gray-600">{stage.description}</p>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div><dt>Wszystkie</dt><dd className="text-2xl font-bold">{stage.total}</dd></div>
        <div><dt>Otwarte</dt><dd className="text-2xl font-bold text-rose-700">{stage.open}</dd></div>
        <div><dt>Archiwum</dt><dd className="text-2xl font-bold">{Math.max(0, stage.total - stage.open)}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-3 text-sm"><Link className="underline" href={`/admin/deposit-claims?kind=${stage.kind}&state=open`}>Otwarte zgłoszenia →</Link><Link className="underline" href={`/admin/deposit-claims?kind=${stage.kind}&state=closed`}>Archiwum →</Link></div>
    </article>)}</div>
    <div className="rounded-lg border bg-white p-4 space-y-2 text-sm">
      <h3 className="font-semibold">Roszczenia dotyczące kaucji</h3>
      <p>Spory oczekujące na decyzję obsługi: <strong>{disputed}</strong></p>
      <p>Propozycje oczekujące na odpowiedź najemcy: <strong>{awaitingRenter}</strong></p>
      <Link className="inline-block underline" href="/admin/deposit-claims?kind=deposit&state=open">Przejdź do otwartych spraw kaucji →</Link>
      <p className="text-xs text-gray-600">Sprawa kaucji może dotyczyć zgłoszenia pokazanego powyżej — tych liczb nie należy sumować.</p>
    </div>
  </section>;
}
