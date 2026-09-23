"use client";

import { useRef, useState, useTransition } from "react";
import { sendMessageAction } from "./actions";

export default function SendMessageForm({ conversationId, isClosed }: { conversationId: string; isClosed: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
      <form
        ref={formRef}
        action={(formData) => {
          if (isClosed || submitting.current) return;
          submitting.current = true;
          setError("");
        startTransition(async () => {
          try {
            await sendMessageAction(conversationId, formData);
            formRef.current?.reset();
          } catch (error) {
            setError(error instanceof Error ? error.message : "Nie udało się wysłać wiadomości. Spróbuj ponownie.");
          } finally {
            submitting.current = false;
          }
        });
        }}
        className="flex gap-2"
        autoComplete="off"
      >
        <input
          type="text"
          name="text"
          placeholder={isClosed ? "Czat zamknięty" : "Napisz wiadomość…"}
          aria-label="Treść wiadomości"
          className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          disabled={isClosed || pending}
          required={!isClosed}
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-50"
          disabled={isClosed || pending}
        >
          {pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {pending ? "Wysyłanie…" : "Wyślij"}
        </button>
      </form>
      {pending && <p role="status" aria-live="polite" className="text-sm text-gray-600">Wysyłamy wiadomość…</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
