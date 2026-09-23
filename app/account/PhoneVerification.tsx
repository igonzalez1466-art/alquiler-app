"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmPhoneVerification, startPhoneVerification } from "./phoneActions";

export default function PhoneVerification({ verified, maskedPhone, returnTo }: { verified: boolean; maskedPhone: string; returnTo: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [codeSent, setCodeSent] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function run(task: () => Promise<void>) { setError(""); setMessage(""); startTransition(() => { void task(); }); }
  return <div id="telefon" className="rounded border p-4 bg-white space-y-3 scroll-mt-24">
    <h2 className="text-lg font-semibold">Numer telefonu</h2>
    {verified && <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-800"><strong>Zweryfikowany:</strong> {maskedPhone}</div>}
    <p className="text-sm text-gray-600">Zweryfikowany numer jest wymagany do rezerwacji. Zostanie udostępniony drugiej stronie dopiero po opłaceniu rezerwacji.</p>
    <label className="block text-sm">{verified ? "Zmień numer" : "Numer telefonu"}
      <input type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} disabled={pending} placeholder="+48 123 456 789" className="mt-1 w-full rounded border p-2" />
    </label>
    <button type="button" disabled={pending || !phone.trim()} onClick={() => run(async () => {
      const result = await startPhoneVerification(phone);
      if (!result.ok) { setError(result.message); return; }
      if (result.alreadyVerified) { setMessage("Ten numer jest już zweryfikowany."); router.refresh(); return; }
      setCodeSent(true); setMessage("Kod SMS został wysłany. Jest ważny przez 10 minut.");
    })} className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Wysyłanie…" : "Wyślij kod SMS"}</button>
    {codeSent && <label className="block text-sm">Kod z SMS
      <div className="mt-1 flex gap-2"><input inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={event => setCode(event.target.value)} disabled={pending} className="min-w-0 flex-1 rounded border p-2" />
        <button type="button" disabled={pending} onClick={() => run(async () => {
          const result = await confirmPhoneVerification(code);
          if (!result.ok) { setError(result.message); return; }
          setCodeSent(false); setPhone(""); setCode(""); setMessage("Numer telefonu został zweryfikowany."); window.dispatchEvent(new Event("profile-tasks-updated")); router.refresh();
        })} className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Potwierdź</button></div>
    </label>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {verified && returnTo && <Link href={returnTo} className="inline-block text-blue-700 underline">Wróć do rezerwacji</Link>}
  </div>;
}
