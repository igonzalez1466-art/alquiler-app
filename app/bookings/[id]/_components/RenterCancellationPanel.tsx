"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelByRenterAction } from "../_actions/cancelByRenterAction";
import { announceBookingAction } from "@/app/lib/bookingActionFeedback";

export default function RenterCancellationPanel({ bookingId, deadline, paid, amountCents, canCancel, isRenter, status }: {
  bookingId: string; deadline: string; paid: boolean; amountCents: number; canCancel: boolean; isRenter: boolean; status: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const router = useRouter();
  if (!canCancel && !status) return null;
  const amount = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(amountCents / 100);
  const retry = isRenter && status === "PENDING";
  return <section className="space-y-3 rounded border bg-white p-4" aria-labelledby="renter-cancel-title">
    <h2 id="renter-cancel-title" className="font-semibold">{status ? "Rezerwacja anulowana przez najemcę" : "Anulowanie rezerwacji"}</h2>
    {status ? <p className="text-sm">{status === "NONE" ? "Rezerwacja nie była opłacona. Nie ma środków do zwrotu." : status === "SUCCEEDED" ? `Zwrot 100% (${amount}) potwierdzony przez Stripe. Termin zaksięgowania zależy od banku.` : status === "FAILED" ? `Zwrot 100% (${amount}) wymaga pomocy obsługi serwisu. Skontaktuj się z nami.` : `Rezerwacja została anulowana. Pełny zwrot (100%): ${amount}. Zwrot oczekuje na potwierdzenie Stripe.`}</p> : <>
      <p className="text-sm">Możesz anulować rezerwację najpóźniej 7 dni przed rozpoczęciem — do {new Date(deadline).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}. {paid ? `Otrzymasz pełny zwrot (100%) zapłaconej kwoty: ${amount}.` : "Jeśli rezerwacja zostanie opłacona, anulowanie w tym terminie zapewnia zwrot 100% płatności."}</p>
      <p className="text-xs text-gray-600">Obie strony otrzymają wiadomość email o anulowaniu.</p>
    </>}
    {canCancel && !confirming && <button type="button" onClick={() => setConfirming(true)} className="rounded border border-rose-300 px-4 py-2 text-rose-700">Anuluj rezerwację</button>}
    {(confirming || retry) && <form onSubmit={async event => {
      event.preventDefault(); if (busy.current) return; busy.current = true; setPending(true); setError("");
      const data = new FormData(); data.set("bookingId", bookingId); data.set("confirm", "yes");
      try { const result = await cancelByRenterAction(data); announceBookingAction(bookingId, result.status === "SUCCEEDED" ? "Rezerwacja anulowana. Zwrot 100% potwierdzony." : "Rezerwacja anulowana. Sprawdź stan zwrotu poniżej."); setConfirming(false); router.refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : "Nie udało się anulować. Spróbuj ponownie."); }
      finally { busy.current = false; setPending(false); }
    }} className="space-y-3">
      {!retry && <p className="text-sm font-medium">Czy na pewno chcesz anulować tę rezerwację?</p>}
      <div className="flex flex-wrap gap-2"><button disabled={pending} className="inline-flex items-center gap-2 rounded bg-rose-700 px-4 py-2 text-white disabled:opacity-50">{pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}{pending ? "Przetwarzanie…" : retry ? "Sprawdź / ponów zwrot" : "Tak, anuluj rezerwację"}</button>
        {!retry && <button disabled={pending} type="button" onClick={() => setConfirming(false)} className="rounded border px-4 py-2">Nie, zachowaj rezerwację</button>}</div>
    </form>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </section>;
}
