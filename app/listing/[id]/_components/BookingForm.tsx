"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createBookingAction } from "../actions";
import BookingCalendar from "./BookingCalendar";

function BookingSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="flex w-full items-center justify-center gap-2 rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {pending ? "Wysyłanie prośby…" : "Zarezerwuj"}
    </button>
  );
}

export default function BookingForm({
  listingId,
  isLoggedIn,
  pricePerDay,
  minimumRentalDays,
  fianza,
  phoneVerified,
  occupiedRanges,
}: {
  listingId: string;
  isLoggedIn: boolean;
  pricePerDay: number;
  minimumRentalDays: number;
  fianza: number;
  phoneVerified: boolean;
  occupiedRanges: { start: string; end: string }[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ✅ NUEVO: aceptar condiciones
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const getDays = useCallback(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");
    const diff = end.getTime() - start.getTime();
    return diff >= 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1 : 0;
  }, [startDate, endDate]);

  const days = getDays();
  const selectedRangeOccupied = !!startDate && !!endDate && occupiedRanges.some(range => range.start <= endDate && range.end >= startDate);

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
    if (selectedRangeOccupied) return { error: "Wybrany termin obejmuje zajęte dni. Wybierz inne daty." as const };

    const d = getDays();
    if (d <= 0) return { error: "Nieprawidłowy zakres dat." as const };

    if (d < minimumRentalDays) return { error: `Minimalny okres wynajmu: ${minimumRentalDays} dni. Wybierz dłuższy okres.` };
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
  }, [startDate, endDate, pricePerDay, fianza, minimumRentalDays, getDays, selectedRangeOccupied]);

  const fmtPL = (d: Date) => d.toLocaleDateString("pl-PL", { timeZone: "UTC" });

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

  if (!phoneVerified) {
    return <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
      <p>Przed wysłaniem prośby o rezerwację zweryfikuj numer telefonu.</p>
      <Link href={`/account?returnTo=${encodeURIComponent(`/listing/${listingId}`)}#telefon`} className="inline-block rounded bg-zinc-900 px-4 py-2 font-semibold text-white">Zweryfikuj numer telefonu</Link>
    </div>;
  }

  return (
    <form action={createBookingAction} className="space-y-4">
      <input type="hidden" name="listingId" value={listingId} />

      <p className="text-sm text-gray-600">Minimalny okres wynajmu: <strong>{minimumRentalDays} {minimumRentalDays === 1 ? "dzień" : "dni"}</strong>. Liczymy dzień rozpoczęcia i zakończenia.</p>
      <BookingCalendar
        today={today}
        occupiedRanges={occupiedRanges}
        startDate={startDate}
        endDate={endDate}
        onChange={(start, end) => { setStartDate(start); setEndDate(end); }}
      />
      <input type="hidden" name="startDate" value={startDate} />
      <input type="hidden" name="endDate" value={endDate} />

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
    </a>
    .
  </span>
</label>


      {/* ===== SUBMIT ===== */}
      <BookingSubmitButton
        disabled={
          days < minimumRentalDays ||
          selectedRangeOccupied ||
          (!!summary && "error" in summary) ||
          !acceptedTerms
        }
      />
    </form>
  );
}
