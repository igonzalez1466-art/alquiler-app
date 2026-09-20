"use client";

import { useState } from "react";
import { confirmDeliveryAction } from "../_actions/confirmDeliveryAction";
import { confirmReturnAction } from "../_actions/confirmReturnAction";
import { reportLogisticsProblemAction } from "../_actions/reportLogisticsProblemAction";

export default function ReceiptActions({ bookingId, stage }: { bookingId: string; stage: "DELIVERY" | "RETURN" }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(action: (data: FormData) => Promise<void>) {
    setPending(true);
    setError("");
    const data = new FormData();
    data.set("bookingId", bookingId);
    data.set("stage", stage);
    try { await action(data); }
    catch (error) { setError(error instanceof Error ? error.message : "Nie udało się zapisać. Spróbuj ponownie."); }
    finally { setPending(false); }
  }
  return <div className="space-y-2">
    <p className="text-sm text-gray-600">Potwierdź odbiór dopiero po otrzymaniu i sprawdzeniu przedmiotu. Jeśli coś jest nie tak, zgłoś problem.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pending} onClick={() => submit(stage === "DELIVERY" ? confirmDeliveryAction : confirmReturnAction)} className="bg-emerald-600 text-white rounded px-4 py-2 disabled:opacity-60">Odebrano</button>
      <button type="button" disabled={pending} onClick={() => submit(reportLogisticsProblemAction)} className="border border-rose-300 text-rose-700 rounded px-4 py-2 disabled:opacity-60">Zgłoś problem</button>
    </div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </div>;
}
