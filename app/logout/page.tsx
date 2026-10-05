"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { signOut } from "next-auth/react";

export default function LogoutPage() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function confirmLogout() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("Nie udało się wylogować. Spróbuj ponownie.");
      busy.current = false;
      setPending(false);
    }
  }

  return <div className="mx-auto max-w-lg px-4 py-12">
    <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm" aria-labelledby="logout-title">
      <h1 id="logout-title" className="text-2xl font-semibold">Wylogowanie</h1>
      <p className="text-gray-700">Czy na pewno chcesz się wylogować?</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={confirmLogout} disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
          {pending ? "Wylogowywanie…" : "Tak, wyloguj mnie"}
        </button>
        {!pending && <Link href="/account" className="rounded-lg border px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">Nie, chcę pozostać zalogowany</Link>}
      </div>
      {pending && <p role="status" className="text-sm text-gray-600">Wylogowywanie…</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </section>
  </div>;
}
