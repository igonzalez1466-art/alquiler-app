"use client";

import { useEffect, useState } from "react";
import { bookingActionFeedbackEvent, type BookingActionFeedbackDetail } from "@/app/lib/bookingActionFeedback";

export default function BookingActionFeedback({ bookingId }: { bookingId: string }) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const key = `${bookingActionFeedbackEvent}:${bookingId}`;
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const value = JSON.parse(stored) as BookingActionFeedbackDetail & { at: number };
        if (value.bookingId === bookingId && Date.now() - value.at < 15_000) setMessage(value.message);
        else sessionStorage.removeItem(key);
      }
    } catch { /* A success message is optional if storage is unavailable. */ }
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<BookingActionFeedbackDetail>).detail;
      if (detail?.bookingId === bookingId) setMessage(detail.message);
    };
    window.addEventListener(bookingActionFeedbackEvent, listener);
    return () => window.removeEventListener(bookingActionFeedbackEvent, listener);
  }, [bookingId]);
  if (!message) return null;
  return <div role="status" aria-live="polite" className="flex items-start justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
    <p><strong>Zapisano.</strong> {message}</p>
    <button type="button" onClick={() => { setMessage(""); try { sessionStorage.removeItem(`${bookingActionFeedbackEvent}:${bookingId}`); } catch {} }} className="font-semibold underline">Zamknij</button>
  </div>;
}
