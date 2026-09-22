// app/bookings/_components/ApproveButton.tsx
"use client";

import { useTransition, useState } from "react";
import { approveBookingAction } from "@/app/bookings/actions";
import Link from "next/link";

export function ApproveButton({ bookingId, phoneVerified }: { bookingId: string; phoneVerified: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await approveBookingAction(bookingId);
        setDone(true);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "No se pudo aprobar";
        setError(message);
      }
    });
  }

  if (done) {
    return <span className="text-green-600">✅ Rezerwacja potwierdzona</span>;
  }

  if (!phoneVerified) return <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
    <p>Przed zaakceptowaniem rezerwacji zweryfikuj numer telefonu.</p>
    <Link href={`/account?returnTo=${encodeURIComponent(`/bookings/${bookingId}`)}#telefon`} className="inline-block rounded bg-zinc-900 px-3 py-2 font-semibold text-white">Zweryfikuj numer telefonu</Link>
  </div>;

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="px-4 py-2 rounded-md bg-green-600 text-white disabled:opacity-50"
    >
      {isPending ? "Zatwierdzanie..." : "Zatwierdź"}
      {error && <span className="ml-2 text-red-500">{error}</span>}
    </button>
  );
}
