"use client";

import { useState } from "react";
import { SPORT_OPTIONS } from "@/app/lib/listingAttributes";

export default function ListingAttributesFields({ inputClassName, labelClassName }: {
  inputClassName: string;
  labelClassName: string;
}) {
  const [gender, setGender] = useState("");
  const [sportEnabled, setSportEnabled] = useState(false);
  const [sport, setSport] = useState("");
  const [otherSport, setOtherSport] = useState("");

  return <>
    <div>
      <label className={labelClassName} htmlFor="gender">Płeć</label>
      <select id="gender" name="gender" required value={gender} onChange={(event) => setGender(event.target.value)} className={`${inputClassName} mt-1`}>
        <option value="">Wybierz</option>
        <option value="WOMAN">Kobieta</option>
        <option value="MAN">Mężczyzna</option>
        <option value="UNISEX">Unisex</option>
        <option value="KIDS">Dziecko</option>
      </select>
    </div>

    <div className="space-y-2">
      <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
        <input type="checkbox" name="isSport" value="yes" checked={sportEnabled} onChange={(event) => setSportEnabled(event.target.checked)} className="h-4 w-4" />
        Sport
      </label>
      {sportEnabled && <label className="block text-sm text-gray-800" htmlFor="sport">
        Dyscyplina sportu
        <select id="sport" name="sport" required value={sport} onChange={event => setSport(event.target.value)} className={`${inputClassName} mt-1`}>
          <option value="" disabled>Wybierz sport</option>
          {SPORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>}
      {sportEnabled && sport === "INNY" && <label className="block text-sm text-slate-800">Jaki to sport? (wymagane)<input name="otherSport" type="text" required maxLength={120} pattern=".*\S.*" title="Podaj nazwę dyscypliny sportu." value={otherSport} onChange={event => setOtherSport(event.target.value)} className={`${inputClassName} mt-1`} placeholder="Np. szermierka, jazda konna" /></label>}
    </div>

    {gender === "WOMAN" && <label className="md:col-span-2 inline-flex items-center gap-2 text-sm font-medium text-gray-800">
      <input type="checkbox" name="pregnancy" value="yes" className="h-4 w-4" />
      Odzież ciążowa
    </label>}
  </>;
}
