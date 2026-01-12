"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  q: string;
  city: string;
  marca: string;
  gender?: string;
  garmentType?: string;
  size: string;
  color: string;
  materials: string;
};

/* ===== LISTAS FIJAS (IGUAL QUE GENDER / GARMENT) ===== */

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
  "XS","S","M","L","XL","XXL",
  "34","36","38","40","42","44","46","48","50",
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
  q,
  city,
  marca,
  gender,
  garmentType,
  size,
  color,
  materials,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {/* Botón móvil */}
      <div className="flex justify-end md:hidden mb-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-white"
        >
          🔍 {open ? "Ukryj filtry" : "Pokaż filtry"}
        </button>
      </div>

      <form
        method="GET"
        className={`rounded-2xl border bg-white p-4 space-y-3 shadow-sm ${
          open ? "block" : "hidden"
        } md:block`}
      >
        <input type="hidden" name="tab" value="all" />

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

          <label className="text-sm">
            <span className="block text-xs text-gray-600 mb-1">Marka</span>
            <input
              name="marca"
              defaultValue={marca}
              placeholder="np. Zara, H&M..."
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </label>
        </div>

        {/* Filtros principales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Gender */}
          <label className="text-sm">
            <span className="block text-xs text-gray-600 mb-1">Dla kogo</span>
            <select
              name="gender"
              defaultValue={gender ?? ""}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Wszyscy</option>
              <option value="WOMAN">Kobieta</option>
              <option value="MAN">Mężczyzna</option>
              <option value="UNISEX">Uniseks</option>
              <option value="KIDS">Dziecięce</option>
            </select>
          </label>

          {/* Garment */}
          <label className="text-sm">
            <span className="block text-xs text-gray-600 mb-1">
              Rodzaj ubrania
            </span>
            <select
              name="garmentType"
              defaultValue={garmentType ?? ""}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Wszystkie</option>
              <option value="TRAJE">Garnitur</option>
              <option value="VESTIDO">Sukienka</option>
              <option value="CAMISA">Koszula</option>
              <option value="PANTALON">Spodnie</option>
              <option value="FALDA">Spódnica</option>
              <option value="CHAQUETA">Marynarka</option>
              <option value="ABRIGO">Płaszcz</option>
              <option value="ZAPATO">Buty</option>
                <option value="BLUSA">Bluzka</option>
              <option value="SUDADERA">Bluza</option>
              <option value="JERSEY">Sweter</option>
              <option value="MONO">Kombinezon</option>
              <option value="CHAMARRA">Kurtka</option>
              <option value="ACCESORIO">Akcesoria</option>
            </select>
          </label>

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
        </div>
{/* Botones */}
<div className="w-full flex flex-wrap items-center justify-end gap-2 pt-1">
  <button
    type="submit"
    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium whitespace-nowrap"
  >
    Zastosuj filtry
  </button>

  <Link
    href="/listing"
    className="px-4 py-2 rounded-lg border text-sm font-medium whitespace-nowrap"
  >
    Wyczyść filtry
  </Link>
</div>

      </form>
    </div>
  );
}
