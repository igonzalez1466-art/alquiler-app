"use client";

import { useState } from "react";

type Range = { start: string; end: string };

const weekdays = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

function dateLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("pl-PL", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

function changeMonth(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

export default function BookingCalendar({ today, occupiedRanges, startDate, endDate, onChange }: {
  today: string;
  occupiedRanges: Range[];
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7));
  const [message, setMessage] = useState("");
  const [year, month] = visibleMonth.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const leadingDays = (firstDay.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthLabel = firstDay.toLocaleDateString("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" });
  const blocked = (day: string) => occupiedRanges.some(range => range.start <= day && range.end >= day);

  const selectDay = (day: string) => {
    if (day < today || blocked(day)) return;
    if (!startDate || endDate || day < startDate) {
      onChange(day, "");
      setMessage("");
      return;
    }
    if (occupiedRanges.some(range => range.start <= day && range.end >= startDate)) {
      onChange(day, "");
      setMessage("Zakres obejmował zajęte dni. Wybrano nowy początek.");
      return;
    }
    onChange(startDate, day);
    setMessage("");
  };

  return <div className="space-y-3 rounded-lg border p-3" aria-label="Wybierz daty rezerwacji">
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={() => setVisibleMonth(changeMonth(visibleMonth, -1))} disabled={visibleMonth <= today.slice(0, 7)} aria-label="Poprzedni miesiąc" className="rounded border px-3 py-1 disabled:opacity-40">‹</button>
      <h3 className="font-semibold capitalize">{monthLabel}</h3>
      <button type="button" onClick={() => setVisibleMonth(changeMonth(visibleMonth, 1))} aria-label="Następny miesiąc" className="rounded border px-3 py-1">›</button>
    </div>
    <p className="text-xs text-gray-600">Wybierz początek, a następnie koniec wynajmu.</p>
    <div className="grid grid-cols-7 gap-1 text-center text-xs">
      {weekdays.map(day => <span key={day} className="py-1 font-semibold text-gray-600">{day}</span>)}
      {Array.from({ length: leadingDays }, (_, index) => <span key={`blank-${index}`} />)}
      {Array.from({ length: daysInMonth }, (_, index) => {
        const day = `${visibleMonth}-${String(index + 1).padStart(2, "0")}`;
        const occupied = blocked(day);
        const past = day < today;
        const selected = day === startDate || day === endDate;
        const withinRange = !!endDate && day > startDate && day < endDate;
        const className = occupied
          ? "bg-red-100 text-red-700 line-through cursor-not-allowed"
          : past
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : selected
              ? "bg-emerald-600 text-white font-semibold"
              : withinRange
                ? "bg-emerald-100 text-emerald-900"
                : "bg-white text-gray-800 hover:bg-emerald-50";
        return <button
          key={day}
          type="button"
          disabled={occupied || past}
          aria-pressed={selected}
          aria-label={`${dateLabel(day)}${occupied ? ", zajęty" : past ? ", minął" : selected ? ", wybrany" : ""}`}
          onClick={() => selectDay(day)}
          className={`aspect-square rounded border text-sm ${className}`}
        >{index + 1}</button>;
      })}
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
      <span><span className="mr-1 inline-block h-3 w-3 rounded bg-red-100 align-middle" />Zajęte</span>
      <span><span className="mr-1 inline-block h-3 w-3 rounded bg-emerald-600 align-middle" />Wybrane</span>
    </div>
    <p className="text-sm">Od: <strong>{startDate ? dateLabel(startDate) : "—"}</strong><br />Do: <strong>{endDate ? dateLabel(endDate) : "—"}</strong></p>
    {message && <p role="status" className="text-sm text-amber-800">{message}</p>}
  </div>;
}
