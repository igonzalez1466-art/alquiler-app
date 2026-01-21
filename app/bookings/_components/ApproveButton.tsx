// app/bookings/_components/ApproveButton.tsx
"use client";

import { useTransition, useState } from "react";
import { approveBookingAction } from "@/app/bookings/actions";

export function ApproveButton({ bookingId }: { bookingId: string }) {
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
