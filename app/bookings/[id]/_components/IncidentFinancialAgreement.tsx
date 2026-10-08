import { formatIncidentMoney } from "@/app/lib/incidentFormatting";
import { rentalAmounts } from "@/app/lib/incidentPolicy";

type Props = {
  stage: "DELIVERY" | "RETURN";
  status: string;
  acceptedAt?: string | Date | null;
  resolution: string | null;
  rentCents: number;
  refundCents: number | null;
  finance?: { platformFeeCents: number | null; ownerPayoutCents: number | null; settlementCompleted: boolean };
};

export default function IncidentFinancialAgreement({ stage, status, acceptedAt, resolution, rentCents, refundCents, finance }: Props) {
  if (!acceptedAt || !["AGREEMENT_REACHED", "RESOLVED"].includes(status)) return null;
  if (stage === "RETURN") return <section aria-label="Uzgodnienie dotyczące zwrotu" className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
    <h4 className="font-semibold text-emerald-950">Uzgodnienie dotyczące zwrotu</h4>
    <p className="text-sm text-emerald-900">Obie strony zaakceptowały rozwiązanie. To zgłoszenie nie zmienia kwoty najmu ani nie nalicza odszkodowania przez platformę.</p>
    {resolution && <p className="whitespace-pre-wrap text-sm text-slate-700"><strong>Komentarz: </strong>{resolution}</p>}
  </section>;
  if (!Number.isSafeInteger(rentCents) || rentCents <= 0 || refundCents === null || !Number.isSafeInteger(refundCents) || refundCents < 0 || refundCents > rentCents) return null;
  const remaining = rentCents - refundCents;
  let amounts: { fee: number; payout: number } | null = remaining === 0 ? { fee: 0, payout: 0 } : null;
  if (finance?.platformFeeCents !== null && finance?.platformFeeCents !== undefined && finance.ownerPayoutCents !== null) {
    try { amounts = rentalAmounts(rentCents, finance.platformFeeCents, finance.ownerPayoutCents, refundCents); }
    catch { /* Older reservations may lack a complete financial breakdown. */ }
  }
  const completed = status === "RESOLVED" && !!finance?.settlementCompleted;
  const rows: [string, number][] = [
    ["Pierwotna kwota najmu", rentCents],
    ["Uzgodniony zwrot dla najemcy", refundCents],
    ["Kwota najmu po uzgodnieniu", remaining],
    ...(amounts ? [["Prowizja MojaSzafa", amounts.fee], ["Należne właścicielowi", amounts.payout]] as [string, number][] : []),
  ];
  return <section aria-label="Uzgodnienie finansowe" className="space-y-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h4 className="text-lg font-semibold text-emerald-950">Uzgodnienie finansowe</h4>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800">Zaakceptowane przez obie strony</span>
    </div>
    <p className="text-sm text-emerald-900">Zaakceptowano: {new Date(acceptedAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>
    <dl className="divide-y divide-emerald-200 rounded-xl bg-white px-4">
      {rows.map(([label, value]) => <div key={label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm"><dt className="text-slate-600">{label}</dt><dd className="font-semibold tabular-nums text-slate-950">{formatIncidentMoney(value)}</dd></div>)}
    </dl>
    <p className="text-sm font-semibold text-emerald-950">{remaining === 0 ? "Anulowanie rezerwacji i zwrot 100% najmu." : "Najem jest kontynuowany po uzgodnionej cenie."}</p>
    {resolution && <p className="whitespace-pre-wrap text-sm text-slate-700"><strong>Komentarz: </strong>{resolution}</p>}
    <p role="status" className="rounded-xl bg-white/80 p-3 text-sm text-slate-700">{completed ? refundCents > 0 ? "Rozliczenie wykonane. Zwrot został przetworzony; termin pojawienia się środków na rachunku zależy od banku." : "Rozliczenie wykonane. Nie uzgodniono zwrotu dla najemcy." : "Rozliczenie w toku. Akceptacja porozumienia nie oznacza jeszcze zwrotu środków na rachunek najemcy."}</p>
  </section>;
}
