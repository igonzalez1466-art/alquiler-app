"use client";

import { useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function PublishButton() {
  const { pending } = useFormStatus();
  return <div className="space-y-2">
    <button type="submit" disabled={pending} className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-white font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-60 disabled:cursor-wait">
      {pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {pending ? "Publikowanie…" : "Opublikuj"}
    </button>
    <p role="status" aria-live="polite" className="text-sm text-gray-600">{pending ? "Zapisujemy ogłoszenie i zdjęcia. Poczekaj na zakończenie." : ""}</p>
  </div>;
}

export default function PublishForm({ action, children, className }: {
  action: (data: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  const busy = useRef(false);
  const [error, setError] = useState("");
  return <form className={className} onSubmit={event => {
    // Lock synchronously, before React renders the pending button (also covers Enter).
    if (busy.current) { event.preventDefault(); return; }
    busy.current = true;
    setError("");
  }} action={async data => {
    try { await action(data); }
    catch (error) {
      // Next.js redirects are control flow and must reach the framework.
      if (typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
      setError("Nie udało się potwierdzić publikacji. Sprawdź „Moje ogłoszenia” przed ponowną próbą.");
    } finally { busy.current = false; }
  }}>
    {children}
    {error && <p role="alert" className="px-6 pb-6 text-sm text-rose-700">{error} <a href="/listing?tab=my" className="underline">Moje ogłoszenia</a></p>}
  </form>;
}
