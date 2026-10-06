"use client";

import { useRef, useState, type ReactNode } from "react";
import IncidentPhotoPicker from "./IncidentPhotoPicker";
import ClaimActionButton from "@/app/components/ClaimActionButton";
import { useRouter } from "next/navigation";
import { incidentAction, openIncidentAction } from "../_actions/incidentActions";
import { prepareBookingPhoto } from "@/app/lib/prepareBookingPhoto";
import { incidentReasons, reasonsForStage, incidentRequiresPhotos, REQUIRED_INCIDENT_PHOTOS_MESSAGE, canActOnIncident, INCIDENT_WAIT_MESSAGE } from "@/app/lib/incidentPolicy";

type Case = { id: string; stage: "DELIVERY" | "RETURN"; reason: keyof typeof incidentReasons; status: string; description: string; resolution: string | null; refundCents: number | null; proposedById: string | null; createdAt: string; resolvedAt: string | null; acceptedAt?: string | Date | null; evidence: { id: string; text: string; createdAt: string }[] };
const statusLabels: Record<string, string> = { OPEN: "Otwarte", AWAITING_OWNER: "Czeka na właściciela", AWAITING_RENTER: "Czeka na najemcę", AGREEMENT_REACHED: "Uzgodnione — rozliczenie w toku", ESCALATED: "Wymaga wyjaśnienia", RESOLVED: "Zakończone" };
export default function IncidentPanel({ bookingId, userId, isOwner, rentCents, canOpenDelivery, canOpenReturn, cases, deliveryPhotos }: {
  bookingId: string; userId: string; isOwner: boolean; rentCents: number; canOpenDelivery: boolean; canOpenReturn: boolean; cases: Case[]; deliveryPhotos?: ReactNode;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const [selectedReasons, setSelectedReasons] = useState({ DELIVERY: reasonsForStage.DELIVERY[0], RETURN: reasonsForStage.RETURN[0] });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [responseMode, setResponseMode] = useState<Record<string, "reject" | "request_cancel" | undefined>>({});
  async function run(data: FormData, open = false) {
    if (busy.current) return;
    busy.current = true;
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
      await (open ? openIncidentAction(data) : incidentAction(data)); setResponseMode({}); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Nie udało się zapisać."); }
    finally { busy.current = false; setPending(false); }
  }
  const button = "rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50";
  return <section id="incident-section" className="space-y-4 rounded-2xl border bg-white p-5 sm:p-6 scroll-mt-24">
    <h2 className="text-lg font-semibold">Zgłoszenia i uzgodnienia</h2>
    <p className="text-sm">Przed potwierdzeniem odbioru problem z dostawą wstrzymuje wypłatę. Po potwierdzeniu odbioru najem nie stanowi zabezpieczenia. Problemy ze zwrotem nie zmniejszają należnego wynagrodzenia.</p>
    {cases.map(c => <article id={`incident-${c.stage.toLowerCase()}`} key={c.id} className="space-y-4 rounded-xl border p-4 scroll-mt-24">
      <h3 className="font-semibold">{c.stage === "DELIVERY" ? "Dostawa" : "Zwrot"}: {incidentReasons[c.reason]}</h3>
      <p className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-900">{statusLabels[c.status]} · {new Date(c.createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>
      <p className="whitespace-pre-wrap text-sm text-slate-600">{c.description}</p>
      <p className="rounded-lg bg-slate-50 p-3 text-sm font-medium">{c.status === "RESOLVED" ? c.acceptedAt ? "Rozwiązanie zaakceptowane przez obie strony. Zgłoszenie zakończone." : "Zgłoszenie zakończone." : c.status === "AGREEMENT_REACHED" ? "Rozwiązanie zaakceptowane. Rozliczenie w toku." : canActOnIncident(c, isOwner) ? "Twoja kolej — odpowiedz poniżej." : `Czekamy na odpowiedź ${canActOnIncident(c, true) ? "właściciela" : "najemcy"}.`}</p>
      {c.resolution && <p className="whitespace-pre-wrap rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm"><strong>{["RESOLVED", "AGREEMENT_REACHED"].includes(c.status) ? "Uzgodnione rozwiązanie: " : "Ostatnia propozycja: "}</strong> {c.resolution}{c.stage === "DELIVERY" && <> · Zwrot: {((c.refundCents ?? 0) / 100).toFixed(2)} zł</>}</p>}
      {c.evidence.length > 0 && <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-medium">Historia zgłoszenia ({c.evidence.length})</summary><div className="mt-3 space-y-2">{[...c.evidence].reverse().map(e => <p key={e.id} className="whitespace-pre-wrap rounded bg-gray-50 p-2 text-sm">{e.text} · {new Date(e.createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>)}</div></details>}
      {!["RESOLVED", "AGREEMENT_REACHED"].includes(c.status) && !canActOnIncident(c, isOwner) && <p role="status" className="rounded bg-amber-50 p-3 text-sm text-amber-900">{INCIDENT_WAIT_MESSAGE}</p>}
      {!["RESOLVED", "AGREEMENT_REACHED"].includes(c.status) && <fieldset disabled={pending || !canActOnIncident(c, isOwner)} className="space-y-3 disabled:opacity-50">
        {(c.stage === "DELIVERY" ? isOwner : !isOwner) && <form action={d => run(d)} className="space-y-2">
          <input type="hidden" name="incidentId" value={c.id} /><input type="hidden" name="operation" value="propose" />
          <label className="block text-sm">Komentarz<textarea name="resolution" required maxLength={2000} className="block w-full rounded border p-2" /></label>
          {c.stage === "DELIVERY" ? <label className="block text-sm">Kwota zwrotu w zł (pełny zwrot: {(rentCents / 100).toFixed(2)} zł)<input name="refundZl" type="number" min="0" max={rentCents / 100} step="0.01" required defaultValue="0" className="block rounded border p-2" /></label> : <input type="hidden" name="refundCents" value="0" />}
          <ClaimActionButton disabled={pending} className={`${button} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`}>Zaproponuj rozwiązanie</ClaimActionButton>
        </form>}
        {c.proposedById && c.proposedById !== userId && ["AWAITING_OWNER", "AWAITING_RENTER"].includes(c.status) && <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <form action={d => run(d)}><input type="hidden" name="incidentId" value={c.id} /><input type="hidden" name="operation" value="accept" />
            {c.stage === "DELIVERY" && (c.refundCents ?? 0) < rentCents && <label className="mb-2 block text-sm"><input type="checkbox" required name="receivedAndAccepted" value="yes" /> Otrzymałem przedmiot i akceptuję najem po uzgodnionej cenie.</label>}
            <ClaimActionButton disabled={pending} className={button + " border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700"}>{isOwner && c.stage === "DELIVERY" && c.refundCents === rentCents ? "Akceptuję anulowanie i zwrot 100%" : "Akceptuję rozwiązanie"}</ClaimActionButton>
          </form>
          <button type="button" disabled={pending} className={button} onClick={() => setResponseMode(current => ({ ...current, [c.id]: "reject" }))}>Odrzucam propozycję</button>
        </div>}
        {!isOwner && c.stage === "DELIVERY" && <button type="button" disabled={pending} className={button} onClick={() => setResponseMode(current => ({ ...current, [c.id]: "request_cancel" }))}>Poproś o anulowanie rezerwacji</button>}
        {responseMode[c.id] && <form action={d => run(d)} className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <input type="hidden" name="incidentId" value={c.id} /><input type="hidden" name="operation" value={responseMode[c.id]} />
          <p className="text-sm font-semibold">{responseMode[c.id] === "reject" ? "Dlaczego odrzucasz propozycję?" : "Prośba o anulowanie i pełny zwrot"}</p>
          {responseMode[c.id] === "request_cancel" && <p className="text-sm">Właściciel musi zaakceptować prośbę. Po akceptacji rezerwacja zostanie anulowana i otrzymasz zwrot 100% najmu ({(rentCents / 100).toFixed(2)} zł). Samo wysłanie prośby nie anuluje rezerwacji.</p>}
          <label className="block text-sm">Komentarz (wymagany)<textarea autoFocus name="comment" required maxLength={2000} className="mt-1 block w-full rounded border bg-white p-2" /></label>
          <div className="flex flex-wrap gap-2"><ClaimActionButton disabled={pending} className={button + " border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700"}>{responseMode[c.id] === "reject" ? "Wyślij odrzucenie" : "Wyślij prośbę o anulowanie"}</ClaimActionButton><button type="button" disabled={pending} className={button} onClick={() => setResponseMode(current => ({ ...current, [c.id]: undefined }))}>Wróć</button></div>
        </form>}
        {c.status !== "ESCALATED" && <form action={d => run(d)}><input type="hidden" name="incidentId" value={c.id} /><input type="hidden" name="operation" value="escalate" /><ClaimActionButton disabled={pending} className={button}>Poproś o wyjaśnienie sprawy</ClaimActionButton></form>}
      </fieldset>}
      {c.status === "AGREEMENT_REACHED" && <form action={d => run(d)}><input type="hidden" name="incidentId" value={c.id} /><input type="hidden" name="operation" value="retry" /><p className="text-sm">Oczekujemy na rozliczenie Stripe. W razie opóźnienia można ponowić tę samą operację.</p><ClaimActionButton disabled={pending} className={button}>Sprawdź / ponów rozliczenie</ClaimActionButton></form>}
      {c.stage === "RETURN" && <p className="text-xs text-gray-600">MojaSzafa zachowuje zgłoszenie i dowody do analizy historii konta. Nie ustala odszkodowania ani winy. Roszczenia dotyczące przedmiotu strony kierują poza platformą; dane mogą być udostępnione właściwym organom na podstawie ważnego żądania i obowiązujących zasad.</p>}
    </article>)}
    {(["DELIVERY", "RETURN"] as const).map(stage => (stage === "DELIVERY" ? canOpenDelivery : canOpenReturn) && !cases.some(c => c.stage === stage) && <details id={`incident-${stage.toLowerCase()}`} key={stage} className="rounded border p-3 scroll-mt-24">
      <summary className="cursor-pointer font-medium">Zgłoś problem — {stage === "DELIVERY" ? "dostawa" : "zwrot"}</summary>
      <form action={d => run(d, true)} className="mt-3 space-y-3">
        <input type="hidden" name="stage" value={stage} />
        <label className="block text-sm">Powód<select required name="reason" value={selectedReasons[stage]} onChange={event => setSelectedReasons(current => ({ ...current, [stage]: event.target.value as keyof typeof incidentReasons }))} className="block rounded border p-2">{reasonsForStage[stage].map(r => <option key={r} value={r}>{incidentReasons[r]}</option>)}</select></label>
        <label className="block text-sm">Opis<textarea name="description" required maxLength={2000} className="block w-full rounded border p-2" /></label>
        <IncidentPhotoPicker required={incidentRequiresPhotos(stage, selectedReasons[stage])} disabled={pending} />
        <ClaimActionButton disabled={pending} className={button}>Wyślij zgłoszenie</ClaimActionButton>
      </form>
    </details>)}
    {deliveryPhotos}
    {pending && <p role="status" className="text-sm">Zapisywanie…</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </section>;
}
