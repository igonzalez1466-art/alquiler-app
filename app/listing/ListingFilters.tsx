"use client";

import GarmentTypeFields from "@/app/components/GarmentTypeFields";
import { useState } from "react";
import Link from "next/link";
import { SPORT_OPTIONS } from "@/app/lib/listingAttributes";

type Props = {
  tab: string;
  status: string;
  sort: string;
  min: string;
  max: string;
  q: string;
  city: string;
  marca: string;
  gender?: string;
  sport: string;
  pregnancy: boolean;
  garmentType?: string;
  accessoryType?: string;
  size: string;
  color: string;
  materials: string;
};

/* ===== LISTAS FIJAS ===== */

const COLORS = [
  { value: "CZARNY", label: "czarny" },
  { value: "BIALY", label: "biały" },
  { value: "SZARY", label: "szary" },
  { value: "BEZOWY", label: "beżowy" },
  { value: "BRAZOWY", label: "brązowy" },
  { value: "CZERWONY", label: "czerwony" },
  { value: "ROZOWY", label: "różowy" },
  { value: "ZIELONY", label: "zielony" },
  { value: "NIEBIESKI", label: "niebieski" },
  { value: "GRANATOWY", label: "granatowy" },
  { value: "WIELOKOLOROWY", label: "wielokolorowy" },
];

const SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "36",
  "38",
  "40",
  "42",
  "44",
  "46",
  "48",
  "50",
];

const MATERIALS = [
  { value: "BAWELNA", label: "bawełna" },
  { value: "WELNA", label: "wełna" },
  { value: "JEDWAB", label: "jedwab" },
  { value: "LEN", label: "len" },
  { value: "POLIESTER", label: "poliester" },
  { value: "AKRYL", label: "akryl" },
  { value: "WISKOZA", label: "wiskoza" },
  { value: "SKORA", label: "skóra" },
  { value: "INNE", label: "inne" },
];

export default function ListingFilters({
  tab, status, sort, min, max,
  q,
  city,
  marca,
  gender,
  sport,
  pregnancy,
  garmentType,
  accessoryType,
  size,
  color,
  materials,
}: Props) {
  const [open, setOpen] = useState(Boolean(marca || gender || sport || pregnancy || color || materials));
  const [selectedGender, setSelectedGender] = useState(gender ?? "");
  const [pregnancyOnly, setPregnancyOnly] = useState(pregnancy);

  return (
    <div>
      <form action="/listing" method="GET" className="surface-card space-y-4 p-4 sm:p-6">
        <input type="hidden" name="tab" value={tab} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="sort" value={sort} />
        {/* Buscador */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm">
            <span className="block text-xs text-gray-600 mb-1">Szukaj</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Tytuł, opis, marka..."
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="block text-xs text-gray-600 mb-1">
              Miasto / kod pocztowy
            </span>
            <input
              name="city"
              defaultValue={city}
              placeholder="np. Wrocław"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </label>

          <div className="flex items-end"><button type="submit" className="ui-btn ui-btn-primary w-full">Szukaj ogłoszeń</button></div>
        </div>

        {/* Filtros principales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Garment */}
          <GarmentTypeFields key={`${garmentType ?? ""}:${accessoryType ?? ""}`} garmentType={garmentType} accessoryType={accessoryType} className="md:col-span-2" />

          {/* Size */}
          <label className="text-sm">
            <span className="block text-xs text-gray-600 mb-1">Rozmiar</span>
            <select
              name="size"
              defaultValue={size}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Wszystkie</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="text-sm"><legend className="mb-1 text-xs text-slate-600">Cena za dzień (zł)</legend><div className="flex gap-2"><input aria-label="Cena minimalna" name="min" type="number" min="0" step="any" defaultValue={min} placeholder="Od" className="min-w-0 w-full rounded-lg border px-3 py-2" /><input aria-label="Cena maksymalna" name="max" type="number" min="0" step="any" defaultValue={max} placeholder="Do" className="min-w-0 w-full rounded-lg border px-3 py-2" /></div></fieldset>
        </div>
        <button type="button" aria-expanded={open} aria-controls="listing-extra-filters" onClick={()=>setOpen(!open)} className="text-sm font-semibold text-violet-700">{open ? "− Mniej filtrów" : "+ Więcej filtrów"}</button>
        <div id="listing-extra-filters" hidden={!open} className="space-y-4 border-t border-slate-100 pt-4">
          <div className="grid gap-3 sm:grid-cols-3">          <label className="text-sm">
            <span className="block text-xs text-gray-600 mb-1">Marka</span>
            <input
              name="marca"
              defaultValue={marca}
              placeholder="np. Zara, H&M..."
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </label>          {/* Gender */}
          <label className="text-sm">
            <span className="block text-xs text-gray-600 mb-1">Dla kogo</span>
            <select
              name="gender"
              value={selectedGender}
              onChange={(event) => {
                setSelectedGender(event.target.value);
                if (event.target.value !== "WOMAN") setPregnancyOnly(false);
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Wszyscy</option>
              <option value="WOMAN">Kobieta</option>
              <option value="MAN">Mężczyzna</option>
              <option value="UNISEX">Uniseks</option>
              <option value="KIDS">Dziecięce</option>
            </select>
          </label>

          {/* Color */}
          <label className="text-sm">
            <span className="block text-xs text-gray-600 mb-1">Kolor</span>
            <select
              name="color"
              defaultValue={color}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Wszystkie</option>
              {COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
</div>
        {/* Material */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-xs text-gray-600 mb-1">Materiał</span>
            <select
              name="materials"
              defaultValue={materials}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Wszystkie</option>
              {MATERIALS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-gray-600 mb-1">Sport</span>
            <select name="sport" defaultValue={sport} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Bez filtra sportowego</option>
              <option value="ANY">Wszystkie sporty</option>
              {SPORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="pregnancy" value="1" checked={pregnancyOnly} onChange={(event) => {
            setPregnancyOnly(event.target.checked);
            if (event.target.checked) setSelectedGender("WOMAN");
          }} className="h-4 w-4" />
          Odzież ciążowa
        </label>

        </div>
        {/* Botones */}
        <div className="w-full flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="submit"
            className="ui-btn ui-btn-primary"
          >
            Zastosuj filtry
          </button>

          <Link
            href={tab === "my" ? `/listing?tab=my&status=${status}` : "/listing"}
            className="px-4 py-2 rounded-lg border text-sm font-medium whitespace-nowrap"
          >
            Wyczyść filtry
          </Link>
        </div>
      </form>
    </div>
  );
}
