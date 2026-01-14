// app/bookings/_components/RejectButton.tsx
"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { rejectBookingAction } from "@/app/bookings/actions";

export default function RejectButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onClick = () => {
    if (!confirm("Czy na pewno chcesz odrzucić tę rezerwację?")) return;

    setError(null);

    startTransition(async () => {
      try {
        await rejectBookingAction(bookingId);

        setDone(true);
        router.refresh();
      } catch (e: unknown) {
        const message =
          e instanceof Error
            ? e.message
            : "Nie udało się odrzucić rezerwacji";
        setError(message);
      }
    });
  };

  // Estado final
  if (done) {
    return <span className="text-red-600 font-medium">❌ Odrzucona</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="px-3 py-2 rounded-md bg-red-600 text-white
                 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Odrzucanie…" : "Odrzuć"}
      {error && <span className="ml-2 text-xs text-red-200">{error}</span>}
    </button>
  );
}
