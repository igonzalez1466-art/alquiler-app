"use client";
import { formatCalendarDate, warsawCalendarDate } from "@/app/lib/rentalCalendarDate";
import { userMessage } from "@/app/lib/userMessage";

import { useRef, useState, type ReactNode } from "react";
import { formatIncidentMoney, formatIncidentEvidenceText } from "@/app/lib/incidentFormatting";
import IncidentPhotoPicker from "./IncidentPhotoPicker";
import IncidentFinancialAgreement from "./IncidentFinancialAgreement";
import ClaimActionButton from "@/app/components/ClaimActionButton";
import { useRouter } from "next/navigation";
import { incidentAction, openIncidentAction } from "../_actions/incidentActions";
import { prepareBookingPhoto } from "@/app/lib/prepareBookingPhoto";
import { incidentReasons, reasonsForStage, incidentRequiresPhotos, REQUIRED_INCIDENT_PHOTOS_MESSAGE, canActOnIncident, INCIDENT_WAIT_MESSAGE } from "@/app/lib/incidentPolicy";

type Case = { reportedDeliveryDate?: string | null; lateDelivery?: { delayDays: number; totalDays: number; refundCents: number } | null; id: string; stage: "DELIVERY" | "RETURN"; reason: keyof typeof incidentReasons; status: string; description: string; resolution: string | null; refundCents: number | null; proposedById: string | null; createdAt: string; resolvedAt: string | null; acceptedAt?: string | Date | null; evidence: { id: string; text: string; createdAt: string }[] };
const statusLabels: Record<string, string> = { OPEN: "Otwarte", AWAITING_OWNER: "Czeka na właściciela", AWAITING_RENTER: "Czeka na najemcę", AGREEMENT_REACHED: "Uzgodnione — rozliczenie w toku", ESCALATED: "Wymaga wyjaśnienia", RESOLVED: "Zakończone" };
export default function IncidentPanel({ bookingId, userId, isOwner, rentCents, canOpenDelivery, canOpenReturn, cases, deliveryPhotos, finance }: {
  bookingId: string; userId: string; isOwner: boolean; rentCents: number; canOpenDelivery: boolean; canOpenReturn: boolean; cases: Case[]; deliveryPhotos?: ReactNode; finance?: { platformFeeCents: number | null; ownerPayoutCents: number | null; settlementCompleted: boolean };
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
    } catch (e) { setError(userMessage(e, "Nie udało się zapisać.")); }
    finally { busy.current = false; setPending(false); }
  }
  const button = "ui-btn";
  return <section id="incident-section" className="surface-card space-y-5 p-5 sm:p-7 scroll-mt-24">
    <h2 className="text-lg font-semibold">Zgłoszenia i uzgodnienia</h2>
    <p className="text-sm leading-6 text-slate-600">Przed potwierdzeniem odbioru problem z dostawą wstrzymuje wypłatę. Po potwierdzeniu odbioru najem nie stanowi zabezpieczenia. Problemy ze zwrotem nie zmniejszają należnego wynagrodzenia.</p>
    {cases.map(c => {
      const canRespond = !!c.proposedById && c.proposedById !== userId && ["AWAITING_OWNER", "AWAITING_RENTER"].includes(c.status);
      const canRequestCancellation = !isOwner && c.stage === "DELIVERY" && c.reason === "NOT_AS_DESCRIBED";
      return <article id={`incident-${c.stage.toLowerCase()}`} key={c.id} className="space-y-5 rounded-2xl border border-slate-200 p-5 sm:p-6 scroll-mt-24">
      <h3 className="font-semibold">{c.stage === "DELIVERY" ? "Dostawa" : "Zwrot"}: {incidentReasons[c.reason]}</h3>
      <p className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-900">{statusLabels[c.status]} · {new Date(c.createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>
      <p className="rounded-xl border-l-4 border-violet-500 bg-violet-50 p-4 text-sm font-medium text-violet-950">{c.status === "RESOLVED" ? c.acceptedAt ? "Rozwiązanie zaakceptowane przez obie strony. Zgłoszenie zakończone." : "Zgłoszenie zakończone." : c.status === "AGREEMENT_REACHED" ? "Rozwiązanie zaakceptowane. Rozliczenie w toku." : canActOnIncident(c, isOwner) ? "Twoja kolej — odpowiedz poniżej." : `Czekamy na odpowiedź ${canActOnIncident(c, true) ? "właściciela" : "najemcy"}.`}</p>
      {c.resolution && !(c.acceptedAt && ["RESOLVED", "AGREEMENT_REACHED"].includes(c.status)) && <p className="whitespace-pre-wrap rounded-2xl border border-violet-200 bg-violet-50 p-5 text-sm leading-7"><strong>{["RESOLVED", "AGREEMENT_REACHED"].includes(c.status) ? "Uzgodnione rozwiązanie: " : "Ostatnia propozycja: "}</strong> {c.resolution}{c.stage === "DELIVERY" && <> · Zwrot: {formatIncidentMoney(c.refundCents ?? 0)}</>}</p>}
      <IncidentFinancialAgreement stage={c.stage} status={c.status} acceptedAt={c.acceptedAt} resolution={c.resolution} rentCents={rentCents} refundCents={c.refundCents} finance={finance} />
      <p className="whitespace-pre-wrap text-sm text-slate-600">{c.description}</p>
      {c.reportedDeliveryDate && <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p><strong>Data odbioru podana przez najemcę:</strong> {formatCalendarDate(c.reportedDeliveryDate)}</p>{c.lateDelivery && !(c.acceptedAt && ["RESOLVED", "AGREEMENT_REACHED"].includes(c.status)) && <><p><strong>Sugerowany zwrot za opóźnienie: {formatIncidentMoney(c.lateDelivery.refundCents)}</strong></p><p>Opóźnienie: {c.lateDelivery.delayDays} {c.lateDelivery.delayDays === 1 ? "dzień" : "dni"}. Kwota najmu × dni opóźnienia / dni rezerwacji ({c.lateDelivery.totalDays}), maksymalnie 100%.</p><p>To sugestia do uzgodnienia. Zwrot wymaga akceptacji obu stron.</p></>}</div>}
      {!["RESOLVED", "AGREEMENT_REACHED"].includes(c.status) && !canActOnIncident(c, isOwner) && <p role="status" className="rounded bg-amber-50 p-3 text-sm text-amber-900">{INCIDENT_WAIT_MESSAGE}</p>}
      {!["RESOLVED", "AGREEMENT_REACHED"].includes(c.status) && <fieldset disabled={pending || !canActOnIncident(c, isOwner)} className="space-y-4 disabled:opacity-50">
        {(c.stage === "DELIVERY" ? isOwner : !isOwner) && <form action={d => run(d)} className="space-y-4 rounded-2xl bg-slate-50 p-4 sm:p-5">
          <input type="hidden" name="incidentId" value={c.id} /><input type="hidden" name="operation" value="propose" />
          <label className="block text-sm">Komentarz<textarea name="resolution" required maxLength={2000} className="block w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
          {c.stage === "DELIVERY" ? <label className="block text-sm">Kwota zwrotu w zł (pełny zwrot: {formatIncidentMoney(rentCents)})<input name="refundZl" type="number" min="0" max={rentCents / 100} step="0.01" required defaultValue={c.lateDelivery ? (c.lateDelivery.refundCents / 100).toFixed(2) : "0"} className="block rounded-xl border border-slate-300 px-3 py-2.5" /></label> : <input type="hidden" name="refundCents" value="0" />}
          <ClaimActionButton disabled={pending} className={`${button} ui-btn-primary`}>Zaproponuj rozwiązanie</ClaimActionButton>
        </form>}
        {(canRespond || canRequestCancellation) && <form action={d => run(d)} className="space-y-3">
          <input type="hidden" name="incidentId" value={c.id} /><input type="hidden" name="operation" value="accept" />
          {canRespond && c.stage === "DELIVERY" && (c.refundCents ?? 0) < rentCents && <label className="block text-sm"><input type="checkbox" required name="receivedAndAccepted" value="yes" /> Otrzymałem przedmiot i akceptuję najem po uzgodnionej cenie.</label>}
          <div className="flex flex-wrap items-center gap-2">
            {canRespond && <>
              <ClaimActionButton disabled={pending} className={button + " border-violet-600 bg-violet-600 text-white hover:bg-violet-700"}>{isOwner && c.stage === "DELIVERY" && c.refundCents === rentCents ? "Akceptuję anulowanie i zwrot 100%" : "Akceptuję rozwiązanie"}</ClaimActionButton>
              <button type="button" disabled={pending} className={button} onClick={() => setResponseMode(current => ({ ...current, [c.id]: "reject" }))}>Odrzucam propozycję</button>
            </>}
            {canRequestCancellation && <button type="button" disabled={pending} className={button} onClick={() => setResponseMode(current => ({ ...current, [c.id]: "request_cancel" }))}>Poproś o anulowanie rezerwacji</button>}
          </div>
        </form>}
        {responseMode[c.id] && <form action={d => run(d)} className="space-y-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <input type="hidden" name="incidentId" value={c.id} /><input type="hidden" name="operation" value={responseMode[c.id]} />
          <p className="text-sm font-semibold">{responseMode[c.id] === "reject" ? "Dlaczego odrzucasz propozycję?" : "Prośba o anulowanie i pełny zwrot"}</p>
          {responseMode[c.id] === "request_cancel" && <p className="text-sm">Właściciel musi zaakceptować prośbę. Po akceptacji rezerwacja zostanie anulowana i otrzymasz zwrot 100% najmu ({formatIncidentMoney(rentCents)}). Samo wysłanie prośby nie anuluje rezerwacji.</p>}
          <label className="block text-sm">Komentarz (wymagany)<textarea autoFocus name="comment" required maxLength={2000} className="mt-1 block w-full rounded border bg-white p-2" /></label>
          <div className="flex flex-wrap gap-2"><ClaimActionButton disabled={pending} className={button + " border-violet-600 bg-violet-600 text-white hover:bg-violet-700"}>{responseMode[c.id] === "reject" ? "Wyślij odrzucenie" : "Wyślij prośbę o anulowanie"}</ClaimActionButton><button type="button" disabled={pending} className={button} onClick={() => setResponseMode(current => ({ ...current, [c.id]: undefined }))}>Wróć</button></div>
        </form>}
      </fieldset>}
      {c.status === "AGREEMENT_REACHED" && <form action={d => run(d)}><input type="hidden" name="incidentId" value={c.id} /><input type="hidden" name="operation" value="retry" /><p className="text-sm">Oczekujemy na rozliczenie Stripe. W razie opóźnienia można ponowić tę samą operację.</p><ClaimActionButton disabled={pending} className={button}>Sprawdź / ponów rozliczenie</ClaimActionButton></form>}
      {c.evidence.length > 0 && <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-medium">Historia zgłoszenia ({c.evidence.length})</summary><div className="mt-3 space-y-2">{[...c.evidence].reverse().map(e => <p key={e.id} className="whitespace-pre-wrap rounded bg-gray-50 p-2 text-sm">{formatIncidentEvidenceText(e.text)} · {new Date(e.createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>)}</div></details>}
      {c.stage === "RETURN" && <p className="text-xs text-gray-600">MojaSzafa zachowuje zgłoszenie i dowody do analizy historii konta. Nie ustala odszkodowania ani winy. Roszczenia dotyczące przedmiotu strony kierują poza platformą; dane mogą być udostępnione właściwym organom na podstawie ważnego żądania i obowiązujących zasad.</p>}
    </article>; })}
    {(["DELIVERY", "RETURN"] as const).map(stage => (stage === "DELIVERY" ? canOpenDelivery : canOpenReturn) && !cases.some(c => c.stage === stage) && <details id={`incident-${stage.toLowerCase()}`} key={stage} className="rounded-2xl border border-slate-200 p-5 scroll-mt-24">
      <summary className="cursor-pointer font-medium">Zgłoś problem — {stage === "DELIVERY" ? "dostawa" : "zwrot"}</summary>
      <form action={d => run(d, true)} className="mt-3 space-y-3">
        <input type="hidden" name="stage" value={stage} />
        <label className="block text-sm">Powód<select required name="reason" value={selectedReasons[stage]} onChange={event => setSelectedReasons(current => ({ ...current, [stage]: event.target.value as keyof typeof incidentReasons }))} className="block rounded-xl border border-slate-300 px-3 py-2.5">{reasonsForStage[stage].map(r => <option key={r} value={r}>{incidentReasons[r]}</option>)}</select></label>
        {stage === "DELIVERY" && selectedReasons[stage] === "LATE_DELIVERY" && <label className="block text-sm">Data odbioru przedmiotu (wymagana)<input name="reportedDeliveryDate" type="date" required max={warsawCalendarDate(new Date())} className="mt-1 block rounded-xl border border-slate-300 px-3 py-2.5" /><span className="mt-1 block text-xs text-slate-600">Podaj dzień, w którym rzeczywiście otrzymałeś przedmiot. Właściciel zobaczy datę i sugerowany zwrot za dni opóźnienia.</span></label>}
        <label className="block text-sm">Opis<textarea name="description" required maxLength={2000} className="block w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
        <IncidentPhotoPicker required={incidentRequiresPhotos(stage, selectedReasons[stage])} disabled={pending} />
        <ClaimActionButton disabled={pending} className={button}>Wyślij zgłoszenie</ClaimActionButton>
      </form>
    </details>)}
    {deliveryPhotos}
    {pending && <p role="status" className="text-sm">Zapisywanie…</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </section>;
}
