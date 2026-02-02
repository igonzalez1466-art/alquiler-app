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
  fianza: number; // pásala como 0 si no hay
}) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
          router.push(
            `/api/auth/signin?callbackUrl=${encodeURIComponent(current)}`
          );
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

      {/* ✅ CUADRO DE RESUMEN: aparece al seleccionar "Koniec" */}
      {endDate && (
        <div className="border rounded-lg p-3 bg-white">
          <div className="font-semibold mb-2">Podsumowanie rezerwacji</div>

          {!summary ? (
            <div className="text-sm text-gray-600">
              Wybierz datę rozpoczęcia i zakończenia.
            </div>
          ) : "error" in summary ? (
            <div className="text-sm text-red-700">{summary.error}</div>
          ) : (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <span>Od</span>
                <span className="font-medium">{fmtPL(summary.start)}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span>Do</span>
                <span className="font-medium">{fmtPL(summary.end)}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span>Liczba dni</span>
                <span className="font-medium">{summary.days}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span>Cena za dzień</span>
                <span className="font-medium">{pricePerDay} zł</span>
              </div>

              <div className="flex justify-between gap-4">
                <span>Koszt najmu</span>
                <span className="font-semibold">{summary.rentTotal} zł</span>
              </div>

              <div className="flex justify-between gap-4">
                <span>Kaucja</span>
                <span className="font-semibold">{summary.deposit} zł</span>
              </div>

              <div className="mt-2 pt-2 border-t flex justify-between gap-4">
                <span className="font-semibold">Razem do zapłaty</span>
                <span className="font-bold">{summary.total} zł</span>
              </div>

              <div className="mt-2 text-xs text-gray-600">
                Kaucja jest zwrotna zgodnie z warunkami (po zwrocie produktu i
                potwierdzeniu braku uszkodzeń).
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        className="px-4 py-2 rounded bg-indigo-600 text-white w-full"
        disabled={days <= 0 || (!!summary && "error" in summary)}
      >
        Zarezerwuj
      </button>
    </form>
  );
}
