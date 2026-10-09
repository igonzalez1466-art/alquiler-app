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
  return <section id="tozsamosc" className="scroll-mt-24 space-y-4 p-5 sm:p-6" aria-labelledby="identity-title">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="identity-title" className="font-semibold text-slate-900">Tożsamość</h3><span role="status" className={`rounded-full px-2.5 py-1 text-xs font-semibold ${view.status === "verified" && !view.testMode ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{labels[view.status] ?? labels.unverified}{view.status === "verified" && view.testMode ? " (test)" : ""}</span></div>
    {view.testMode && <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Tryb testowy — wynik jest symulowany i nie potwierdza rzeczywistej tożsamości.</p>}
    <p className="text-sm leading-6 text-slate-500">{requirementSatisfied ? "Weryfikacja ukończona. Jedna weryfikacja służy zarówno najemcy, jak i właścicielowi." : "Zweryfikuj tożsamość, aby publikować ogłoszenia, rezerwować i rozpoczynać płatności."}</p>
    <div className="flex flex-wrap gap-2">
      {requirementSatisfied && returnTo && <Link href={returnTo} className="ui-btn ui-btn-primary">Wróć i kontynuuj</Link>}
      {view.status !== "verified" && view.status !== "processing" && <button type="button" disabled={pending || !view.enabled} onClick={() => void run("start")} className="ui-btn ui-btn-primary">{pending ? "Łączenie…" : view.status === "requires_input" ? "Kontynuuj weryfikację" : "Zweryfikuj tożsamość"}</button>}
      {view.status !== "unverified" && <button type="button" disabled={pending} onClick={() => void run("refresh")} className="ui-btn">{pending ? "Sprawdzanie…" : "Sprawdź status"}</button>}
    </div>
    <details className="rounded-xl border border-slate-100 p-3 text-sm"><summary className="cursor-pointer font-medium text-slate-600">Jak działa weryfikacja i co widzą inni?</summary><div className="mt-3 space-y-3 leading-6 text-slate-500"><p>Stripe sprawdzi dokument tożsamości i porówna go ze zdjęciem twarzy. Nie musisz zakładać konta Stripe.</p><p>MojaSzafa zapisuje status, datę i identyfikator weryfikacji. Nie pobieramy kopii dokumentu ani zdjęć. Druga strona widzi wyłącznie oznaczenie zweryfikowanej tożsamości. Dostęp upoważnionej obsługi do danych w Stripe opisuje <Link href="/polityka-prywatnosci" className="text-violet-700 underline underline-offset-4">polityka prywatności</Link>.</p></div></details>
    {!view.enabled && view.status !== "verified" && <p className="text-sm text-slate-500">Weryfikacja jest obecnie niedostępna. Spróbuj później.</p>}
    {pending && <p role="status" className="text-sm text-violet-700">Trwa przetwarzanie…</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
  </section>;
}
