type Props = {
  isOwner: boolean;
  rentCents: number | null;
  feeCents: number | null;
  ownerTransferCents: number | null;
  retainedCents: number | null;
  compensationCents: number | null;
  refundCents: number | null;
  refundRecorded: boolean;
  depositStatus: string;
  completedAt: Date;
};
const money = (value: number | null) => value === null ? "—" :
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(value / 100);

export default function FinalSettlementSummary(p: Props) {
  const ownerTotal = p.ownerTransferCents !== null && p.compensationCents !== null
    ? p.ownerTransferCents + p.compensationCents : null;
  const refundConfirmed = ["REFUNDED", "PARTIALLY_REFUNDED"].includes(p.depositStatus);
  const refundStatus = p.depositStatus === "FAILED" ? "Zwrot nieudany — wymaga sprawdzenia" : p.refundCents === 0 ? "Brak zwrotu kaucji" :
    refundConfirmed ? "Zwrot potwierdzony" : p.refundRecorded ? "Zwrot zlecony — oczekuje na potwierdzenie" : "Brak potwierdzenia zwrotu";
  return <section className="rounded border bg-white p-4 space-y-4">
    <h2 className="text-lg font-semibold">Podsumowanie rozliczenia</h2>
    <p className="text-xs text-gray-600">Rozliczenie zapisano: {p.completedAt.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })} (czas polski)</p>
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-4"><dt>Koszt najmu</dt><dd>{money(p.rentCents)}</dd></div>
      {p.isOwner && <div className="flex justify-between gap-4"><dt>Prowizja MojaSzafa</dt><dd>{p.feeCents === null ? "—" : `−${money(p.feeCents)}`}</dd></div>}
      {p.isOwner && <div className="flex justify-between gap-4"><dt>Najem — przekazano właścicielowi</dt><dd>{money(p.ownerTransferCents)}</dd></div>}
      <div className="flex justify-between gap-4"><dt>{p.isOwner ? "Kaucja przekazana właścicielowi" : "Zatrzymana część kaucji"}</dt><dd>{money(p.isOwner ? p.compensationCents : p.retainedCents)}</dd></div>
      {p.isOwner && <div className="flex justify-between gap-4 rounded bg-emerald-50 p-3 font-semibold"><dt>Łącznie przekazano właścicielowi</dt><dd>{money(ownerTotal)}</dd></div>}
      <div className="flex justify-between gap-4 rounded bg-indigo-50 p-3 font-semibold"><dt>Zwrot kaucji najemcy</dt><dd>{money(p.refundCents)}</dd></div>
    </dl>
    <p className="text-sm">{refundStatus}</p>
    <p className="text-xs text-gray-600">{p.isOwner && "Kwoty przekazane właścicielowi dotyczą jego salda Stripe. Wypłata na rachunek bankowy jest osobnym etapem. "}Potwierdzenie zwrotu nie oznacza jeszcze zaksięgowania go w banku najemcy.</p>
    {p.isOwner && ownerTotal === null && <p className="text-sm text-amber-800">Brakuje pełnych danych o transferach. Łączna kwota nie została potwierdzona.</p>}
  </section>;
}
