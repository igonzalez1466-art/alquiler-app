"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { claimReasons, type DepositClaim } from "@/app/lib/depositClaim";
import { proposeDepositClaimAction, respondDepositClaimAction, resolveDepositClaimBySupportAction, executeApprovedClaimAction } from "../_actions/depositClaimActions";
import { releaseDepositAction } from "../_actions/depositActions";

const money = (cents: number) => new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(cents / 100);
const date = (value: string) => new Date(value).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
type Props = {
  bookingId: string; depositCents: number; claim: DepositClaim | null; hasClaim: boolean;
  isOwner: boolean; isRenter: boolean; isSupport?: boolean; canPropose?: boolean;
  canRefund?: boolean; returnCompleted?: boolean; initialReason?: string;
  initialReasonCode?: keyof typeof claimReasons; completed: boolean; settling: boolean;
};

export default function DepositClaimPanel(p: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const busy = useRef(false);
  const submit = (action: (data: FormData) => Promise<void>) => async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current) return;
    const data = new FormData(event.currentTarget);
    data.set("bookingId", p.bookingId);
    if (p.claim) data.set("claimId", p.claim.id);
    busy.current = true; setPending(true); setError("");
    try { await action(data); setProposing(false); setDisputing(false); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Nie udało się zapisać. Spróbuj ponownie."); }
    finally { busy.current = false; setPending(false); }
  };
  const button = "rounded border px-4 py-2 bg-white disabled:opacity-50";
  const input = "mt-1 w-full rounded border p-2 bg-white";
  const claim = p.claim;
  if (p.depositCents <= 0) return <p className="text-sm text-gray-600">Rezerwacja nie zawiera kaucji.</p>;
  if (p.hasClaim && !claim) return <p role="alert">Roszczenie wymaga weryfikacji przez obsługę serwisu. Kaucja pozostaje zablokowana.</p>;
  return <div className="space-y-3 text-sm">
    {claim ? <div className="rounded border bg-gray-50 p-4 space-y-3">
      <h3 className="font-semibold">Roszczenie dotyczące kaucji</h3>
      <p>{p.completed ? "Rozliczenie zapisane. Status zwrotu środków widoczny powyżej." : claim.status === "PENDING" ? "Oczekuje na odpowiedź najemcy. Kaucja jest zablokowana." : claim.status === "DISPUTED" ? "Spór przekazany do obsługi serwisu. Kaucja jest zablokowana." : "Decyzja zatwierdzona. Można wykonać rozliczenie zgodnie z poniższymi kwotami."}</p>
      <p><strong>Wnioskowane potrącenie:</strong> {money(claim.retainedCents)} z {money(p.depositCents)}</p>
      <p><strong>Powód:</strong> {claimReasons[claim.reasonCode]}</p>
      <p className="whitespace-pre-wrap break-words">{claim.reason}</p>
      <p className="text-xs text-gray-600">Zgłoszono: {date(claim.proposedAt)}</p>
      {claim.renterResponse && <p className="whitespace-pre-wrap break-words"><strong>Odpowiedź najemcy:</strong> {claim.renterResponse}</p>}
      {claim.resolutionNote && <p className="whitespace-pre-wrap break-words"><strong>Uzasadnienie obsługi:</strong> {claim.resolutionNote}</p>}
      {claim.status === "APPROVED" && <>
        <p>Potrącenie: <strong>{money(claim.approvedRetainedCents ?? 0)}</strong> · Zwrot najemcy: <strong>{money(p.depositCents - (claim.approvedRetainedCents ?? 0))}</strong></p>
        <p>Zatwierdzenie: {claim.resolutionSource === "RENTER" ? "zgoda najemcy" : "decyzja obsługi"}{claim.approvedAt ? " · " + date(claim.approvedAt) : ""}</p>
        {!p.completed && <form onSubmit={submit(executeApprovedClaimAction)}>
          <button disabled={pending} className={button}>{pending ? "Przetwarzanie…" : p.settling ? "Ponów zatwierdzone rozliczenie" : "Wykonaj zatwierdzone rozliczenie"}</button>
          <p className="mt-2 text-xs text-gray-600">Ten przycisk uruchomi operacje finansowe. Kwoty zatwierdzonej decyzji nie mogą zostać zmienione.</p>
        </form>}
      </>}
      {claim.status === "PENDING" && p.isRenter && <>
        <form onSubmit={submit(respondDepositClaimAction)} className="space-y-3">
          <input type="hidden" name="response" value="ACCEPT" />
          <label className="flex items-start gap-2"><input type="checkbox" required name="consent" value="yes" disabled={pending} /><span>Zgadzam się na potrącenie {money(claim.retainedCents)} i zwrot pozostałych {money(p.depositCents - claim.retainedCents)}.</span></label>
          <button disabled={pending} className={button}>Akceptuję propozycję</button>
        </form>
        {!disputing ? <button disabled={pending} className={button} onClick={() => setDisputing(true)}>Nie zgadzam się</button> : <form onSubmit={submit(respondDepositClaimAction)} className="space-y-3">
          <input type="hidden" name="response" value="DISPUTE" />
          <label className="block">Dlaczego nie zgadzasz się z propozycją?<textarea name="note" required maxLength={2000} rows={3} disabled={pending} className={input} /></label>
          <button disabled={pending} className={button}>Przekaż spór do obsługi</button>
        </form>}
      </>}
      {claim.status === "DISPUTED" && p.isSupport && <form onSubmit={submit(resolveDepositClaimBySupportAction)} className="space-y-3 border-t pt-3">
        <label className="block">Zatwierdzone potrącenie (zł). Wpisz 0, aby odrzucić roszczenie.
          <input type="number" name="retainedAmountZl" min="0" max={claim.retainedCents / 100} step="0.01" required disabled={pending} className={input} />
        </label>
        <label className="block">Uzasadnienie decyzji<textarea name="note" required maxLength={2000} rows={3} disabled={pending} className={input} /></label>
        <label className="flex gap-2"><input type="checkbox" name="consent" value="yes" required disabled={pending} />Potwierdzam decyzję po sprawdzeniu sprawy.</label>
        <button disabled={pending} className={button}>Zatwierdź rozstrzygnięcie</button>
      </form>}
    </div> : <>
      {p.completed ? <p>Kaucja została rozliczona.</p> : p.settling ? <p>Rozliczenie zostało rozpoczęte.</p> : <>
        {!p.returnCompleted && <p>Rozliczenie kaucji będzie dostępne po odbiorze zwrotu. W przypadku uszkodzeń właściciel może zaproponować potrącenie bez zamykania zgłoszonego problemu jako rozwiązanego.</p>}
        {p.isOwner && p.canRefund && <form onSubmit={submit(releaseDepositAction)} className="space-y-2">
          <p>Zwrot pełnej kaucji: {money(p.depositCents)}</p>
          <button disabled={pending} className={button}>Zwróć całą kaucję</button>
        </form>}
        {p.isOwner && p.canPropose && (!proposing ? <button disabled={pending} className={button} onClick={() => setProposing(true)}>Zaproponuj potrącenie z kaucji</button> : <form onSubmit={submit(proposeDepositClaimAction)} className="rounded border p-3 space-y-3">
          <p>Propozycja nie przenosi pieniędzy. Najemca może ją zaakceptować lub przekazać spór do obsługi. Brak odpowiedzi nie oznacza zgody.</p>
          <label className="block">Kwota do zatrzymania (zł)
            <input type="number" name="retainedAmountZl" min="0.01" max={p.depositCents / 100} step="0.01" required disabled={pending} className={input} />
          </label>
          <p>Wpisz {money(p.depositCents)}, aby zaproponować zatrzymanie całej kaucji.</p>
          <label className="block">Powód<select name="reasonCode" defaultValue={p.initialReasonCode ?? "OTHER"} disabled={pending} className={input}>{Object.entries(claimReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="block">Opis i uzasadnienie kwoty<textarea name="reason" defaultValue={p.initialReason ?? ""} required maxLength={2000} rows={3} disabled={pending} className={input} /></label>
          <label className="flex items-start gap-2"><input type="checkbox" name="received" value="yes" required disabled={pending} /><span>Potwierdzam faktyczny odbiór zwracanego przedmiotu. Zgłoszony problem nadal wymaga rozliczenia.</span></label>
          <div className="flex gap-2"><button disabled={pending} className={button}>Wyślij propozycję najemcy</button><button type="button" disabled={pending} onClick={() => setProposing(false)} className={button}>Anuluj</button></div>
        </form>)}
      </>}
    </>}
    {error && <p role="alert" className="text-rose-700">{error}</p>}
  </div>;
}
