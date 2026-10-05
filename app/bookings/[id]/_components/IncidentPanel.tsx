"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { incidentAction, openIncidentAction } from "../_actions/incidentActions";
import { prepareBookingPhoto } from "@/app/lib/prepareBookingPhoto";
import { incidentReasons, reasonsForStage, incidentRequiresPhotos, REQUIRED_INCIDENT_PHOTOS_MESSAGE } from "@/app/lib/incidentPolicy";

type Case = { id: string; stage: "DELIVERY" | "RETURN"; reason: keyof typeof incidentReasons; status: string; description: string; resolution: string | null; refundCents: number | null; proposedById: string | null; createdAt: string; resolvedAt: string | null; evidence: { id: string; text: string; createdAt: string }[] };
const statusLabels: Record<string, string> = { OPEN: "Otwarte", AWAITING_OWNER: "Czeka na właściciela", AWAITING_RENTER: "Czeka na najemcę", AGREEMENT_REACHED: "Uzgodnione — rozliczenie w toku", ESCALATED: "Wymaga wyjaśnienia", RESOLVED: "Zakończone" };
export default function IncidentPanel({ bookingId, userId, isOwner, rentCents, canOpenDelivery, canOpenReturn, cases, deliveryPhotos }: {
  bookingId: string; userId: string; isOwner: boolean; rentCents: number; canOpenDelivery: boolean; canOpenReturn: boolean; cases: Case[]; deliveryPhotos?: ReactNode;
}) {
  const router = useRouter();
  const [selectedReasons, setSelectedReasons] = useState({ DELIVERY: reasonsForStage.DELIVERY[0], RETURN: reasonsForStage.RETURN[0] });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function run(data: FormData, open = false) {
    setPending(true); setError(""); data.set("bookingId", bookingId);
    try {
      if (data.has("refundZl")) {
        const value = String(data.get("refundZl")).replace(",", ".");
        if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Podaj kwotę w złotych z maksymalnie dwoma miejscami po przecinku.");
        data.set("refundCents", String(Math.round(Number(value) * 100)));
      }
      if (open) {
        const files = data.getAll("photos").filter((v): v is File => v instanceof File && v.size > 0);
        if (incidentRequiresPhotos(String(data.get("stage")), String(data.get("reason"))) && files.length === 0) throw new Error(REQUIRED_INCIDENT_PHOTOS_MESSAGE);
        if (files.length > 3) throw new Error("Maksymalnie 3 zdjęcia.");
        data.delete("photos");
        for (const f of files) data.append("photos", await prepareBookingPhoto(f));
      }
      await (open ? openIncidentAction(data) : incidentAction(data)); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Nie udało się zapisać."); }
    finally { setPending(false); }
  }
  const button = "rounded border px-3 py-2 text-sm disabled:opacity-50";
  return <section id="incident-section" className="space-y-4 rounded border bg-white p-4">
    <h2 className="text-lg font-semibold">Zgłoszenia i uzgodnienia</h2>
    <p className="text-sm">Przed potwierdzeniem odbioru problem z dostawą wstrzymuje wypłatę. Po potwierdzeniu odbioru najem nie stanowi zabezpieczenia. Problemy ze zwrotem nie zmniejszają należnego wynagrodzenia.</p>
    {cases.map(c => <article key={c.id} className="space-y-3 rounded border p-3">
      <h3 className="font-semibold">{c.stage === "DELIVERY" ? "Dostawa" : "Zwrot"}: {incidentReasons[c.reason]}</h3>
      <p className="text-sm">{statusLabels[c.status]} · {new Date(c.createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>
      <p className="whitespace-pre-wrap text-sm">{c.description}</p>
      {c.resolution && <p className="whitespace-pre-wrap text-sm">Propozycja: {c.resolution}{c.stage === "DELIVERY" && <> · Zwrot: {((c.refundCents ?? 0) / 100).toFixed(2)} zł</>}</p>}
      {c.evidence.map(e => <p key={e.id} className="whitespace-pre-wrap rounded bg-gray-50 p-2 text-sm">{e.text} · {new Date(e.createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>)}
      {!["RESOLVED", "AGREEMENT_REACHED"].includes(c.status) && <>
        {(c.stage === "DELIVERY" ? isOwner : !isOwner) && <form action={d => run(d)} className="space-y-2">
          <input type="hidden" name="incidentId" value={c.id} /><input type="hidden" name="operation" value="propose" />
          <label className="block text-sm">Uzgodnione rozwiązanie<textarea name="resolution" required maxLength={2000} className="block w-full rounded border p-2" /></label>
          {c.stage === "DELIVERY" ? <label className="block text-sm">Kwota zwrotu w zł (pełny zwrot: {(rentCents / 100).toFixed(2)} zł)<input name="refundZl" type="number" min="0" max={rentCents / 100} step="0.01" required defaultValue="0" className="block rounded border p-2" /></label> : <input type="hidden" name="refundCents" value="0" />}
          <button disabled={pending} className={button}>Zaproponuj rozwiązanie</button>
        </form>}
        {c.proposedById && c.proposedById !== userId && ["AWAITING_OWNER", "AWAITING_RENTER"].includes(c.status) && <div className="flex gap-2">{["accept", "reject"].map(operation => <form key={operation} action={d => run(d)}><input type="hidden" name="incidentId" value={c.id} /><input type="hidden" name="operation" value={operation} />{operation === "accept" && c.stage === "DELIVERY" && (c.refundCents ?? 0) < rentCents && <label className="block text-sm"><input type="checkbox" required name="receivedAndAccepted" value="yes" /> Otrzymałem przedmiot i akceptuję najem po uzgodnionej cenie.</label>}<button disabled={pending} className={button}>{operation === "accept" ? "Akceptuję rozwiązanie" : "Odrzucam propozycję"}</button></form>)}</div>}
        <form action={d => run(d)} className="space-y-2"><input type="hidden" name="incidentId" value={c.id} /><input type="hidden" name="operation" value="evidence" /><label className="block text-sm">Komentarz / tracking / opis dokumentu<textarea required name="evidence" maxLength={2000} className="block w-full rounded border p-2" /></label><button disabled={pending} className={button}>Dodaj dowód / komentarz</button></form>
        {c.status !== "ESCALATED" && <form action={d => run(d)}><input type="hidden" name="incidentId" value={c.id} /><input type="hidden" name="operation" value="escalate" /><button disabled={pending} className={button}>Poproś o wyjaśnienie sprawy</button></form>}
      </>}
      {c.status === "AGREEMENT_REACHED" && <form action={d => run(d)}><input type="hidden" name="incidentId" value={c.id} /><input type="hidden" name="operation" value="retry" /><p className="text-sm">Oczekujemy na rozliczenie Stripe. W razie opóźnienia można ponowić tę samą operację.</p><button disabled={pending} className={button}>Sprawdź / ponów rozliczenie</button></form>}
      {c.stage === "RETURN" && <p className="text-xs text-gray-600">MojaSzafa zachowuje zgłoszenie i dowody do analizy historii konta. Nie ustala odszkodowania ani winy. Roszczenia dotyczące przedmiotu strony kierują poza platformą; dane mogą być udostępnione właściwym organom na podstawie ważnego żądania i obowiązujących zasad.</p>}
    </article>)}
    {(["DELIVERY", "RETURN"] as const).map(stage => (stage === "DELIVERY" ? canOpenDelivery : canOpenReturn) && !cases.some(c => c.stage === stage) && <details key={stage} className="rounded border p-3">
      <summary className="cursor-pointer font-medium">Zgłoś problem — {stage === "DELIVERY" ? "dostawa" : "zwrot"}</summary>
      <form action={d => run(d, true)} className="mt-3 space-y-3">
        <input type="hidden" name="stage" value={stage} />
        <label className="block text-sm">Powód<select required name="reason" value={selectedReasons[stage]} onChange={event => setSelectedReasons(current => ({ ...current, [stage]: event.target.value as keyof typeof incidentReasons }))} className="block rounded border p-2">{reasonsForStage[stage].map(r => <option key={r} value={r}>{incidentReasons[r]}</option>)}</select></label>
        <label className="block text-sm">Opis<textarea name="description" required maxLength={2000} className="block w-full rounded border p-2" /></label>
        <label className="block text-sm">{incidentRequiresPhotos(stage, selectedReasons[stage]) ? "Zdjęcia (wymagane, od 1 do 3)" : "Zdjęcia (opcjonalnie, do 3)"}<input required={incidentRequiresPhotos(stage, selectedReasons[stage])} type="file" name="photos" multiple accept="image/jpeg,image/png,image/webp" className="block" /></label>
        <button disabled={pending} className={button}>Wyślij zgłoszenie</button>
      </form>
    </details>)}
    {deliveryPhotos}
    {pending && <p role="status" className="text-sm">Zapisywanie…</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </section>;
}
