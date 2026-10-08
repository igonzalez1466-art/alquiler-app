"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { identityAction } from "./identityActions";

type View = { status: string; verifiedAt: string | null; testMode: boolean; enabled: boolean };
const labels: Record<string, string> = { unverified: "Niezweryfikowana", requires_input: "Wymaga uzupełnienia", processing: "Weryfikacja w toku", verified: "Tożsamość zweryfikowana", canceled: "Weryfikacja anulowana", redacted: "Dane weryfikacji usunięte" };
export default function IdentityVerification({ initial, returnTo, requirementSatisfied }: { initial: View; returnTo: string | null; requirementSatisfied: boolean }) {
  const [view, setView] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const returned = useRef(false);
  const router = useRouter();
  useEffect(() => { setView(initial); }, [initial]);
  async function run(operation: "start" | "refresh") {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      const result = await identityAction(operation, returnTo);
      if (!result.ok) { setError(result.message); return; }
      setView(result);
      if (result.url) window.location.assign(result.url);
      else router.refresh();
    } catch { setError("Nie udało się połączyć. Spróbuj ponownie."); }
    finally { busy.current = false; setPending(false); }
  }
  useEffect(() => {
    if (!returned.current && new URLSearchParams(window.location.search).get("identity") === "return") {
      returned.current = true;
      void run("refresh");
    }
    // A return from Stripe triggers a server check, never an automatic approval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (view.status !== "processing") return;
    let count = 0;
    const timer = window.setInterval(() => { if (++count > 12) { window.clearInterval(timer); return; } void run("refresh"); }, 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.status]);
  return <section id="tozsamosc" className="surface-card space-y-4 p-5 scroll-mt-24">
    <h2 className="text-lg font-semibold">Weryfikacja tożsamości</h2>
    {view.testMode && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Tryb testowy — wynik jest symulowany i nie potwierdza rzeczywistej tożsamości.</p>}
    <p role="status" className={`rounded-xl p-3 text-sm font-semibold ${view.status === "verified" ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-700"}`}>{labels[view.status] ?? labels.unverified}{view.status === "verified" && view.testMode ? " (test)" : ""}</p>
    <p className="text-sm leading-6 text-slate-600">Weryfikacja tożsamości jest wymagana przed publikacją ogłoszenia, wysłaniem prośby o rezerwację i rozpoczęciem płatności.</p>
    {requirementSatisfied && returnTo && <Link href={returnTo} className="ui-btn ui-btn-primary">Wróć i kontynuuj</Link>}
    <p className="text-sm leading-6 text-slate-600">Stripe sprawdzi dokument tożsamości i porówna go ze zdjęciem twarzy. Jedna weryfikacja służy zarówno najemcy, jak i właścicielowi. Nie musisz zakładać konta Stripe.</p>
    <p className="text-sm leading-6 text-slate-600">MojaSzafa zapisuje status, datę i identyfikator weryfikacji. Nie pobieramy kopii dokumentu ani zdjęć. Druga strona widzi wyłącznie oznaczenie zweryfikowanej tożsamości. Dostęp upoważnionej obsługi do danych w Stripe opisuje <Link href="/polityka-prywatnosci" className="underline">polityka prywatności</Link>.</p>
    <div className="flex flex-wrap gap-3">
      {view.status !== "verified" && view.status !== "processing" && <button type="button" disabled={pending || !view.enabled} onClick={() => void run("start")} className="ui-btn ui-btn-primary disabled:opacity-50">{pending ? "Łączenie…" : view.status === "requires_input" ? "Kontynuuj weryfikację" : "Zweryfikuj tożsamość"}</button>}
      {view.status !== "unverified" && <button type="button" disabled={pending} onClick={() => void run("refresh")} className="ui-btn disabled:opacity-50">{pending ? "Sprawdzanie…" : "Sprawdź status"}</button>}
    </div>
    {!view.enabled && view.status !== "verified" && <p className="text-sm text-slate-600">Weryfikacja jest obecnie niedostępna. Spróbuj później.</p>}
    {pending && <p role="status" className="text-sm text-violet-700">Trwa przetwarzanie…</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </section>;
}
