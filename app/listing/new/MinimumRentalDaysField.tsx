"use client";
import { useState } from "react";
import { MINIMUM_RENTAL_DAYS, MAXIMUM_RENTAL_DAYS } from "@/app/lib/minimumRentalDays";
import { ListingFieldError } from "./ListingFieldErrors";

export default function MinimumRentalDaysField() {
  const [choice, setChoice] = useState("3");
  const [custom, setCustom] = useState("3");
  return <fieldset className="space-y-3">
    <legend className="text-sm font-medium text-slate-700">Minimalny okres wynajmu</legend>
    <div className="grid grid-cols-3 gap-2">{[{ value: "3", label: "3 dni" }, { value: "7", label: "7 dni" }, { value: "custom", label: "Własny" }].map(option => <label key={option.value} className="cursor-pointer">
      <input type="radio" name="minimumRentalDaysChoice" value={option.value} checked={choice === option.value} onChange={() => setChoice(option.value)} className="peer sr-only" />
      <span className="flex min-h-14 items-center justify-center rounded-xl border border-slate-300 px-2 py-3 text-sm font-semibold text-slate-700 peer-checked:border-indigo-600 peer-checked:bg-indigo-50 peer-checked:text-indigo-800 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-indigo-600">{option.label}</span>
    </label>)}</div>
    {choice === "custom" ? <label className="block text-sm">Liczba dni (minimum 3)<input id="minimumRentalDays" name="minimumRentalDays" type="number" min={MINIMUM_RENTAL_DAYS} max={MAXIMUM_RENTAL_DAYS} step={1} required value={custom} onChange={event => setCustom(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      : <input type="hidden" name="minimumRentalDays" value={choice} />}
    <ListingFieldError name="minimumRentalDays" />
    <p className="text-xs leading-relaxed text-slate-500">Minimum 3 dni. Najemca nie może wybrać krótszego okresu. Liczymy dzień rozpoczęcia i zakończenia. Uzgodnij termin wysyłki, aby przedmiot dotarł na czas.</p>
  </fieldset>;
}
