"use client";

import { useState } from "react";
import { confirmDeliveryAction } from "../_actions/confirmDeliveryAction";
import { confirmReturnAction } from "../_actions/confirmReturnAction";
import { reportLogisticsProblemAction } from "../_actions/reportLogisticsProblemAction";
import { issueReasons } from "@/app/lib/logisticsIssue";

export default function ReceiptActions({ bookingId, stage }: { bookingId: string; stage: "DELIVERY" | "RETURN" }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState(false);
  async function submit(action: (data: FormData) => Promise<void>, data = new FormData()) {
    if (pending) return;
    setPending(true);
    setError("");
    data.set("bookingId", bookingId);
    data.set("stage", stage);
    try { await action(data); setReporting(false); }
    catch (error) { setError(error instanceof Error ? error.message : "Nie udało się zapisać. Spróbuj ponownie."); }
    finally { setPending(false); }
  }
  return <div className="space-y-3">
    {!reporting ? <>
      <p className="text-sm text-gray-600">Potwierdź odbiór dopiero po otrzymaniu i sprawdzeniu przedmiotu. Jeśli coś jest nie tak, zgłoś problem.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => submit(stage === "DELIVERY" ? confirmDeliveryAction : confirmReturnAction)} className="bg-emerald-600 text-white rounded px-4 py-2 disabled:opacity-60">Odebrano</button>
        <button type="button" disabled={pending} onClick={() => { setError(""); setReporting(true); }} className="border border-rose-300 text-rose-700 rounded px-4 py-2 disabled:opacity-60">Zgłoś problem</button>
      </div>
    </> : <form onSubmit={(event) => {
      event.preventDefault();
      void submit(reportLogisticsProblemAction, new FormData(event.currentTarget));
    }} className="rounded border border-rose-200 p-3 space-y-3">
      <h3 className="font-medium">Zgłoś problem</h3>
      <p className="text-sm text-gray-600">Wysłanie zgłoszenia wstrzyma potwierdzenie odbioru do czasu rozwiązania problemu.</p>
      <label className="block text-sm">Powód
        <select name="reason" required defaultValue="" disabled={pending} className="mt-1 border rounded p-2 w-full">
          <option value="" disabled>Wybierz powód</option>
          {Object.entries(issueReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="block text-sm">Opis problemu
        <textarea name="description" required maxLength={2000} rows={3} disabled={pending} className="mt-1 border rounded p-2 w-full" />
      </label>
      <p className="text-xs text-gray-500">Maksymalnie 2000 znaków. Szczegóły będą widoczne dla obu stron rezerwacji.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="bg-rose-700 text-white rounded px-4 py-2 disabled:opacity-60">{pending ? "Zapisywanie…" : "Wyślij zgłoszenie"}</button>
        <button type="button" disabled={pending} onClick={() => { setReporting(false); setError(""); }} className="border rounded px-4 py-2">Anuluj</button>
      </div>
    </form>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </div>;
}
