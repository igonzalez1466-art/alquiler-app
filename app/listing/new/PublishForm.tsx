"use client";

import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { ListingErrorsContext } from "./ListingFieldErrors";

const PublishingContext = createContext(false);
export type PublishResult = { error: string; field?: string } | void;

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  return <PublishingContext.Provider value={pending}><ListingErrorsContext.Provider value={fieldErrors}>
    <form className={className} onInvalidCapture={event => {
      const control = event.target as HTMLInputElement;
      const name = control.id === "listing-location" ? "city" : control.name;
      if (name && name !== "city") {
        setFieldErrors(current => ({ ...current, [name]: control.validity.valueMissing ? "Uzupełnij to pole." : control.validationMessage }));
        control.setAttribute("aria-invalid", "true");
        control.setAttribute("aria-describedby", `listing-error-${name}`);
      }
    }} onChangeCapture={event => {
      const control = event.target as HTMLInputElement;
      const name = control.id === "listing-location" ? "city" : control.name;
      if (name) setFieldErrors(current => { const next = { ...current }; delete next[name]; return next; });
      control.removeAttribute("aria-invalid");
      if (control.getAttribute("aria-describedby")?.startsWith("listing-error-")) control.removeAttribute("aria-describedby");
    }} onSubmit={event => {
      event.preventDefault();
      // Invoke the action explicitly: a validation response must not trigger React's
      // automatic reset of uncontrolled fields or the selected photo files.
      if (busy.current) return;
      busy.current = true;
      const form = event.currentTarget;
      const data = new FormData(form);
      setError(""); setUncertain(false); setFieldErrors({});
      startTransition(async () => {
        try {
          const result = await action(data);
          if (result?.error) {
            setError(result.error);
            if (result.field) {
              setFieldErrors({ [result.field]: result.error });
              const control = result.field === "city" ? form.querySelector?.("#listing-location") : form.elements?.namedItem(result.field);
              if (control instanceof HTMLElement) {
                control.setAttribute("aria-invalid", "true");
                control.setAttribute("aria-describedby", `listing-error-${result.field}`);
                control.scrollIntoView({ block: "center", behavior: "smooth" });
                control.focus({ preventScroll: true });
              }
            }
          }
        } catch (cause) {
          if (typeof cause === "object" && cause !== null && "digest" in cause && typeof cause.digest === "string" && cause.digest.startsWith("NEXT_REDIRECT")) throw cause;
          setUncertain(true);
          setError("Nie udało się potwierdzić publikacji. Sprawdź „Moje ogłoszenia” przed ponowną próbą.");
        } finally { busy.current = false; }
      });
    }}>
      {children}
      {error && <p ref={errorRef} role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}{uncertain && <> <Link href="/listing?tab=my" className="underline">Moje ogłoszenia</Link></>}</p>}
    </form>
  </ListingErrorsContext.Provider></PublishingContext.Provider>;
}
