"use client";
import { userMessage } from "@/app/lib/userMessage";

import { useState } from "react";
import ClaimActionButton from "@/app/components/ClaimActionButton";
import { useRouter } from "next/navigation";
import { resolveLogisticsProblemAction } from "../_actions/resolveLogisticsProblemAction";
import { announceBookingAction } from "@/app/lib/bookingActionFeedback";

export default function ResolveIssueForm({ bookingId, stage, hasDeposit }: { bookingId: string; stage: "DELIVERY" | "RETURN"; hasDeposit: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!expanded) return <button type="button" onClick={() => setExpanded(true)} className="border rounded px-4 py-2 text-gray-800 bg-white">Problem rozwiązany</button>;
  return <form className="space-y-3 text-gray-800" onSubmit={async (event) => {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    data.set("bookingId", bookingId);
    data.set("stage", stage);
    setPending(true);
    setError("");
    try { await resolveLogisticsProblemAction(data); announceBookingAction(bookingId, "Problem został oznaczony jako rozwiązany. Sprawdź kolejny krok w sprawie."); setExpanded(false); router.refresh(); }
    catch (error) { setError(userMessage(error, "Nie udało się zapisać. Spróbuj ponownie.")); }
    finally { setPending(false); }
  }}>
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name="receivedAndResolved" value="yes" required disabled={pending} className="mt-1" />
      <span>Potwierdzam, że przedmiot został odebrany i sprawdzony, a zgłoszony problem jest rozwiązany.</span>
    </label>
    <p className="text-sm">{stage === "RETURN"
      ? hasDeposit ? "Zamknięcie zgłoszenia potwierdzi zwrot i umożliwi rozliczenie kaucji zgodnie z zasadami rezerwacji." : "Zamknięcie zgłoszenia potwierdzi zwrot i umożliwi rozliczenie najmu."
      : "Zamknięcie zgłoszenia potwierdzi odbiór i pozwoli kontynuować rezerwację."}</p>
    <p className="text-sm">Jeśli nadal trwa spór lub oczekujesz rekompensaty, pozostaw zgłoszenie otwarte i skontaktuj się z obsługą serwisu.</p>
    <div className="flex flex-wrap gap-2">
      <ClaimActionButton loading={pending} type="submit" disabled={pending} className="bg-emerald-700 text-white rounded px-4 py-2 disabled:opacity-60">Potwierdź odbiór i zamknij zgłoszenie</ClaimActionButton>
      <button type="button" disabled={pending} onClick={() => { setExpanded(false); setError(""); }} className="border rounded px-4 py-2">Anuluj</button>
    </div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </form>;
}
