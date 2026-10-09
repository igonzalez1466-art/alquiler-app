"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmPhoneVerification, startPhoneVerification } from "./phoneActions";
import AccountIcon from "./AccountIcon";

export default function PhoneVerification({ verified, maskedPhone, returnTo }: { verified: boolean; maskedPhone: string; returnTo: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [codeSent, setCodeSent] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function run(task: () => Promise<void>) { setError(""); setMessage(""); startTransition(async () => { await task(); }); }
  return <section id="telefon" className="scroll-mt-24 border-t border-slate-100 p-5 sm:p-6" aria-labelledby="phone-title">
    <div className="flex items-center justify-between gap-3"><h3 id="phone-title" className="flex items-center gap-2 font-semibold text-slate-900"><AccountIcon name="phone" className="h-4 w-4 text-slate-400" />Numer telefonu</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{verified ? "Zweryfikowany" : "Do weryfikacji"}</span></div>
    <p className="mt-3 text-sm leading-6 text-slate-500">{verified ? maskedPhone : "Zweryfikuj numer, aby rezerwować i akceptować rezerwacje."}</p>
    <details open={!verified} className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50">
      <summary className="cursor-pointer p-3 text-sm font-semibold text-violet-700">{verified ? "Zmień numer telefonu" : "Dodaj i zweryfikuj numer"}</summary>
      <div className="space-y-4 px-4 pb-4">
        <p className="text-xs leading-5 text-slate-500">Numer udostępnimy drugiej stronie dopiero po opłaceniu rezerwacji.</p>
        <label className="block text-sm font-medium text-slate-700">Numer telefonu<input type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} disabled={pending} placeholder="+48 123 456 789" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label>
        <button type="button" disabled={pending || !phone.trim()} onClick={() => run(async () => {
          const result = await startPhoneVerification(phone);
          if (!result.ok) { setError(result.message); return; }
          if (result.alreadyVerified) { setMessage("Ten numer jest już zweryfikowany."); router.refresh(); return; }
          setCodeSent(true); setMessage("Kod SMS został wysłany. Jest ważny przez 10 minut.");
        })} className="ui-btn ui-btn-primary">{pending ? "Wysyłanie…" : "Wyślij kod SMS"}</button>
        {codeSent && <label className="block text-sm font-medium text-slate-700">Kod z SMS<div className="mt-2 flex flex-wrap gap-2"><input aria-label="Kod z SMS" autoComplete="one-time-code" inputMode="numeric" maxLength={10} value={code} onChange={event => setCode(event.target.value)} disabled={pending} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /><button type="button" disabled={pending || !code.trim()} onClick={() => run(async () => {
          const result = await confirmPhoneVerification(code);
          if (!result.ok) { setError(result.message); return; }
          setCodeSent(false); setPhone(""); setCode(""); setMessage("Numer telefonu został zweryfikowany."); window.dispatchEvent(new Event("profile-tasks-updated")); router.refresh();
        })} className="ui-btn ui-btn-primary">Potwierdź</button></div></label>}
      </div>
    </details>
    {message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
    {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {verified && returnTo && <Link href={returnTo} className="mt-3 inline-block text-sm font-semibold text-violet-700 underline underline-offset-4">Wróć i kontynuuj</Link>}
  </section>;
}
