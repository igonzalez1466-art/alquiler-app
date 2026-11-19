"use client";
import { userMessage } from "@/app/lib/userMessage";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDeliveryAction } from "../_actions/confirmDeliveryAction";
import { confirmReturnAction } from "../_actions/confirmReturnAction";
export default function ReceiptActions({ bookingId, stage, hideReport = false }: { bookingId: string; stage: "DELIVERY" | "RETURN"; remainingPhotos: number; hasDeposit: boolean; hideReport?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  function openProblem(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const hash = `#incident-${stage.toLowerCase()}`;
    window.history.replaceState(null, "", hash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  async function confirm() {
    setPending(true); setError("");
    try {
      const data = new FormData(); data.set("bookingId", bookingId);
      await (stage === "DELIVERY" ? confirmDeliveryAction(data) : confirmReturnAction(data)); router.refresh();
    } catch (e) { setError(userMessage(e, "Nie udało się zapisać.")); }
    finally { setPending(false); }
  }
  return <div className="space-y-2">
    <p className="text-sm text-gray-600">{stage === "DELIVERY" ? "Sprawdź przedmiot przed potwierdzeniem odbioru. Potwierdzenie dostawy umożliwia wypłatę za najem." : "Potwierdź odbiór dopiero po otrzymaniu zwróconego przedmiotu."}</p>
    <div className="flex gap-2"><button disabled={pending} type="button" onClick={confirm} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">{pending ? "Zapisywanie…" : stage === "DELIVERY" ? "Otrzymałem" : "Przedmiot odebrany"}</button>{!hideReport && <a href={`#incident-${stage.toLowerCase()}`} onClick={openProblem} className="rounded border border-rose-300 px-4 py-2 text-rose-700">Zgłoś problem</a>}</div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </div>;
}
