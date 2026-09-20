"use client";

import { useState } from "react";
import { resolveLogisticsProblemAction } from "../_actions/resolveLogisticsProblemAction";

export default function ResolveIssueForm({ bookingId, stage }: { bookingId: string; stage: "DELIVERY" | "RETURN" }) {
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
    try { await resolveLogisticsProblemAction(data); setExpanded(false); }
    catch (error) { setError(error instanceof Error ? error.message : "Nie udało się zapisać. Spróbuj ponownie."); }
    finally { setPending(false); }
  }}>
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name="receivedAndResolved" value="yes" required disabled={pending} className="mt-1" />
      <span>Potwierdzam, że przedmiot został odebrany i sprawdzony, a zgłoszony problem jest rozwiązany.</span>
    </label>
    <p className="text-sm">{stage === "RETURN"
      ? "Zamknięcie zgłoszenia potwierdzi zwrot i umożliwi rozliczenie kaucji zgodnie z zasadami rezerwacji."
      : "Zamknięcie zgłoszenia potwierdzi odbiór i pozwoli kontynuować rezerwację."}</p>
    <p className="text-sm">Jeśli nadal trwa spór lub oczekujesz rekompensaty, pozostaw zgłoszenie otwarte i skontaktuj się z obsługą serwisu.</p>
    <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={pending} className="bg-emerald-700 text-white rounded px-4 py-2 disabled:opacity-60">{pending ? "Zapisywanie…" : "Potwierdź odbiór i zamknij zgłoszenie"}</button>
      <button type="button" disabled={pending} onClick={() => { setExpanded(false); setError(""); }} className="border rounded px-4 py-2">Anuluj</button>
    </div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </form>;
}
