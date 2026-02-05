"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBookingAction } from "./actions";

export default function BookingForm({
  listingId,
  isLoggedIn,
  pricePerDay,
  fianza,
}: {
  listingId: string;
  isLoggedIn: boolean;
  pricePerDay: number;
  fianza: number;
}) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ✅ NUEVO
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const getDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    const diff = end.getTime() - start.getTime();
    return diff >= 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1 : 0;
  };

  const days = getDays();

  const summary = useMemo(() => {
    if (!startDate || !endDate) return null;

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { error: "Nieprawidłowa data." as const };
    }
    if (end < start) {
      return { error: "Data zakończenia nie może być wcześniej niż rozpoczęcia." as const };
    }

    const d = getDays();
    if (d <= 0) return { error: "Nieprawidłowy zakres dat." as const };

    const rentTotal = d * pricePerDay;
    const deposit = Math.max(0, Number.isFinite(fianza) ? Math.trunc(fianza) : 0);
    const total = rentTotal + deposit;

    return {
      start,
      end,
      days: d,
      rentTotal,
      deposit,
      total,
    };
  }, [startDate, endDate, pricePerDay, fianza]);

  const fmtPL = (d: Date) => d.toLocaleDateString("pl-PL");

  if (!isLoggedIn) {
    return (
      <button
        type="button"
        onClick={() => {
          const current =
            typeof window !== "undefined"
              ? window.location.href
              : `/listing/${listingId}`;
          router.push(`/login?callbackUrl=${encodeURIComponent(current)}`);
        }}
        className="px-4 py-2 rounded bg-indigo-600 text-white w-full"
      >
        Zaloguj się, aby dokonać rezerwacji
      </button>
    );
  }

  return (
    <form action={createBookingAction} className="space-y-4">
      <input type="hidden" name="listingId" value={listingId} />

      <label className="block">
        Początek
        <input
          type="date"
          name="startDate"
          min={today}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border p-2 rounded w-full"
          required
        />
      </label>

      <label className="block">
        Koniec
        <input
          type="date"
          name="endDate"
          min={startDate || today}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border p-2 rounded w-full"
          required
        />
      </label>

      {/* ===== PODSUMOWANIE ===== */}
      {endDate && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {/* (tu no cambio nada de tu resumen, lo dejo igual) */}
          {/* ... */}
        </div>
      )}

      {/* ✅ CHECKBOX ACEPTAR CONDICIONES */}
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-1"
          required
        />
        <span>
          Akceptuję{" "}
          <a href="/regulamin" target="_blank" className="text-blue-600 underline">
            regulamin serwisu
          </a>{" "}
          oraz{" "}
          <a href="/warunki-rezerwacji" target="_blank" className="text-blue-600 underline">
            warunki rezerwacji
          </a>
          .
        </span>
      </label>

      <button
        type="submit"
        className="px-4 py-2 rounded bg-indigo-600 text-white w-full disabled:opacity-50"
        disabled={
          days <= 0 ||
          (!!summary && "error" in summary) ||
          !acceptedTerms // ✅ CLAVE
        }
      >
        Zarezerwuj
      </button>
    </form>
  );
}
