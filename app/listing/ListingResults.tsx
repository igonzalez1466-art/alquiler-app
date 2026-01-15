"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

// Puedes reutilizar las traducciones aquí también
const enumLabels: Record<string, string> = {
  WOMAN: "Kobieta",
  MAN: "Mężczyzna",
  UNISEX: "Unisex",
  KIDS: "Dziecięce",
  ABRIGO: "Płaszcz",
  CHAQUETA: "Kurtka",
  CAMISA: "Koszula",
  BLUSA: "Bluzka",
  VESTIDO: "Sukienka",
  PANTALON: "Spodnie",
  FALDA: "Spódnica",
  TRAJE: "Garnitur",
  SUDADERA: "Bluza",
  JERSEY: "Sweter",
  MONO: "Kombinezon",
  ACCESORIO: "Akcesoria",
  ZAPATO: "Buty",
};

const label = (v?: string | null) => {
  const key = (v ?? "").trim().toUpperCase();
  return key ? enumLabels[key] ?? key : "—";
};

const colorMap: Record<string, string> = {
  negro: "#111111",
  blanco: "#f5f5f5",
  gris: "#9ca3af",
  azul: "#2563eb",
  rojo: "#dc2626",
  verde: "#16a34a",
  beige: "#d1bfa7",
  marrón: "#8b5e34",
  marron: "#8b5e34",
  rosa: "#ec4899",
  morado: "#7e22ce",
  amarillo: "#f59e0b",
  naranja: "#f97316",
};

type Listing = {
  id: string;
  title: string;
  city: string | null;
  postalCode: string | null;
  marca: string | null;
  gender: string | null;
  size: string | null;
  color: string | null;
  garmentType: string | null;
  materials: string[] | null;
  images: { id: string; url: string; alt: string | null }[];
};

export default function ListingResults({ listings }: { listings: Listing[] }) {
  const [open, setOpen] = useState(false);

  if (!listings.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Botón solo en móvil */}
      <div className="md:hidden flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mb-2 px-3 py-2 text-sm border rounded-lg bg-white"
        >
          {open ? "Ukryj listę" : "Pokaż listę ogłoszeń"}
        </button>
      </div>

      {/* Lista: en móvil depende de `open`, en desktop siempre visible */}
      <div className={`${open ? "block" : "hidden"} md:block space-y-4`}>
        {listings.map((l) => {
          const colorBg =
            colorMap[(l.color ?? "").toLowerCase()] ?? "transparent";

          return (
            <Link
              key={l.id}
              href={`/listing/${l.id}`}
              className="block border rounded p-4 space-y-3 hover:shadow-lg transition group bg-white"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold group-hover:underline truncate">
                  {l.title}
                </h2>
              </div>

              <p className="text-sm text-gray-700">
                {l.city ?? "—"}
                {l.postalCode ? ` (${l.postalCode})` : ""}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                <div className="rounded-lg border px-2 py-1 bg-white">
                  <p className="text-[11px] text-gray-500">Marka</p>
                  <p className="truncate">{l.marca ?? "—"}</p>
                </div>

                <div className="rounded-lg border px-2 py-1 bg-white">
                  <p className="text-[11px] text-gray-500">Typ ubrania</p>
                  <p className="truncate">{label(l.garmentType)}</p>
                </div>

                <div className="rounded-lg border px-2 py-1 bg-white">
                  <p className="text-[11px] text-gray-500">Płeć</p>
                  <p className="truncate">{label(l.gender)}</p>
                </div>

                <div className="rounded-lg border px-2 py-1 bg-white">
                  <p className="text-[11px] text-gray-500">Rozmiar</p>
                  <p className="truncate">{l.size ?? "—"}</p>
                </div>

                <div className="rounded-lg border px-2 py-1 bg-white">
                  <p className="text-[11px] text-gray-500">Kolor</p>
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block h-3 w-3 rounded-full border"
                      style={{ backgroundColor: colorBg }}
                    />
                    <span className="truncate">{l.color ?? "—"}</span>
                  </div>
                </div>

                <div className="rounded-lg border px-2 py-1 bg-white col-span-2 md:col-span-1">
                  <p className="text-[11px] text-gray-500">Materiały</p>
                  {Array.isArray(l.materials) && l.materials.length ? (
                    <div className="flex flex-wrap gap-1">
                      {l.materials.slice(0, 2).map((m) => (
                        <span
                          key={m}
                          className="rounded-full border px-1.5 py-0.5 bg-gray-50"
                        >
                          {m}
                        </span>
                      ))}
                      {l.materials.length > 2 && (
                        <span className="text-gray-500">
                          +{l.materials.length - 2}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>

              {l.images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto py-1">
                  {l.images.map((img) => (
                    <div
                      key={img.id}
                      className="relative w-28 h-20 shrink-0 rounded overflow-hidden bg-gray-50"
                    >
                      <Image
                        src={img.url}
                        alt={img.alt ?? l.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
