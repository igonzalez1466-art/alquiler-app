"use client";

import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";

const PublishingContext = createContext(false);
export type PublishResult = { error: string } | void;

export function PublishButton() {
  const pending = useContext(PublishingContext);
  return <div className="space-y-2">
    <button type="submit" disabled={pending} className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-white font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-60 disabled:cursor-wait">
      {pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {pending ? "Publikowanie…" : "Opublikuj"}
    </button>
    <p role="status" aria-live="polite" className="text-sm text-gray-600">{pending ? "Zapisujemy ogłoszenie i zdjęcia. Poczekaj na zakończenie." : ""}</p>
  </div>;
}

export default function PublishForm({ action, children, className }: {
  action: (data: FormData) => Promise<PublishResult>;
  children: ReactNode;
  className?: string;
}) {
  const busy = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [pending, startTransition] = useTransition();
  return <PublishingContext.Provider value={pending}>
    <form className={className} onSubmit={event => {
      event.preventDefault();
      // Invoke the action explicitly: a validation response must not trigger React's
      // automatic reset of uncontrolled fields or the selected photo files.
      if (busy.current) return;
      busy.current = true;
      const data = new FormData(event.currentTarget);
      setError(""); setUncertain(false);
      startTransition(async () => {
        try {
          const result = await action(data);
          if (result?.error) setError(result.error);
        } catch (cause) {
          if (typeof cause === "object" && cause !== null && "digest" in cause && typeof cause.digest === "string" && cause.digest.startsWith("NEXT_REDIRECT")) throw cause;
          setUncertain(true);
          setError("Nie udało się potwierdzić publikacji. Sprawdź „Moje ogłoszenia” przed ponowną próbą.");
        } finally { busy.current = false; }
      });
    }}>
      {children}
      {error && <p ref={errorRef} role="alert" className="px-6 pb-6 text-sm text-rose-700">{error}{uncertain && <> <Link href="/listing?tab=my" className="underline">Moje ogłoszenia</Link></>}</p>}
    </form>
  </PublishingContext.Provider>;
}
