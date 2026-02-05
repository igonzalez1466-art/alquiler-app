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

  // ✅ NUEVO: aceptar condiciones
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
      return {
        error: "Data zakończenia nie może być wcześniej niż rozpoczęcia." as const,
      };
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

  /* ===== USUARIO NO LOGUEADO ===== */
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

      {/* ===== DATY ===== */}
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

      {/* ===== PODSUMOWANIE (TU NO SE TOCA NADA) ===== */}
      {endDate && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Podsumowanie rezerwacji
              </div>
              <div className="text-xs text-gray-600">
                Sprawdź szczegóły przed potwierdzeniem
              </div>
            </div>

            {summary && !("error" in summary) && (
              <span className="shrink-0 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 text-xs font-semibold">
                {summary.days} {summary.days === 1 ? "dzień" : "dni"}
              </span>
            )}
          </div>

          {/* Body */}
          <div className="p-4">
            {!summary ? (
              <div className="text-sm text-gray-600">
                Wybierz datę rozpoczęcia i zakończenia.
              </div>
            ) : "error" in summary ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {summary.error}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-gray-500">Od</div>
                    <div className="font-semibold">
                      {fmtPL(summary.start)}
                    </div>
                  </div>

                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-gray-500">Do</div>
                    <div className="font-semibold">
                      {fmtPL(summary.end)}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border">
                  <div className="divide-y">
                    <div className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-gray-600">Cena za dzień</span>
                      <span className="font-medium">{pricePerDay} zł</span>
                    </div>

                    <div className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-gray-600">Koszt najmu</span>
                      <span className="font-medium">
                        {summary.rentTotal} zł
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-gray-600">
                        Kaucja{" "}
                        <span className="text-xs text-gray-500">
                          (zwrotna)
                        </span>
                      </span>
                      <span className="font-medium">
                        {summary.deposit} zł
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-indigo-50 border-indigo-100 px-3 py-3 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">
                    Razem do zapłaty
                  </span>
                  <span className="text-lg font-bold text-indigo-700">
                    {summary.total} zł
                  </span>
                </div>

                <div className="rounded-lg bg-gray-50 border px-3 py-2 text-xs text-gray-700">
                  Kaucja jest zwrotna zgodnie z warunkami (po zwrocie produktu i
                  potwierdzeniu braku uszkodzeń).
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== CHECKBOX CONDICIONES ===== */}
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
          <a
            href="/regulamin"
            target="_blank"
            className="text-indigo-600 underline"
          >
            regulamin serwisu
          </a>{" "}
          oraz{" "}
          <a
            href="/warunki-rezerwacji"
            target="_blank"
            className="text-indigo-600 underline"
          >
            warunki rezerwacji
          </a>
          .
        </span>
      </label>

      {/* ===== SUBMIT ===== */}
      <button
        type="submit"
        className="px-4 py-2 rounded bg-indigo-600 text-white w-full disabled:opacity-50"
        disabled={
          days <= 0 ||
          (!!summary && "error" in summary) ||
          !acceptedTerms
        }
      >
        Zarezerwuj
      </button>
    </form>
  );
}
