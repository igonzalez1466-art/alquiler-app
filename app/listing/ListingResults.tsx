"use client";
import Link from "next/link";
import ListingPhotoGallery from "@/app/components/ListingPhotoGallery";
import { sportLabel, accessoryLabel } from "@/app/lib/listingAttributes";
const enumLabels: Record<string, string> = {
  // Gender
  WOMAN: "Kobieta",
  MAN: "Mężczyzna",
  UNISEX: "Unisex",
  KIDS: "Dziecięce",

  // GarmentType
  ABRIGO: "Płaszcz",
  MARYNARKA: "Marynarka",
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
  OTRO: "Inne",
};

const label = (v?: string | null) => {
  const key = (v ?? "").trim().toUpperCase();
  return key ? enumLabels[key] ?? key : "—";
};


type Listing = {
  id: string;
  title: string;
  available: boolean;
  city: string | null;
  postalCode: string | null;
  pricePerDay: number; // ✅ PRECIO DIARIO
  marca: string | null;
  gender: string | null;
  sport: string | null;
  pregnancy: boolean;
  size: string | null;
  color: string | null;
  garmentType: string | null;
  accessoryType?: string | null;
  materials: string[] | null;
  images: { id: string; url: string; alt: string | null }[];
};


export default function ListingResults({ listings, showStatus = false }: { listings: Listing[]; showStatus?: boolean }) {
  if (!listings.length) return <p className="rounded-2xl border bg-white p-6 text-sm text-slate-600">Nie znaleźliśmy pasujących ogłoszeń. Zmień lub usuń wybrane filtry.</p>;
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Ogłoszenia">
    {listings.map(l => <article key={l.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
      <div className="relative">
        <ListingPhotoGallery cover photos={l.images} title={l.title} />
        {showStatus && <span className={`pointer-events-none absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${l.available ? "bg-white text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{l.available ? "Aktywne" : "Nieaktywne"}</span>}
      </div>
      <Link href={`/listing/${l.id}`} className="block space-y-2 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
        <p className="text-xs text-slate-500">{accessoryLabel(l.accessoryType) ?? label(l.garmentType)}{l.size ? ` · Rozmiar ${l.size}` : ""}</p>
        <h2 className="line-clamp-2 font-semibold text-slate-900 group-hover:text-indigo-700">{l.title}</h2>
        <p className="text-sm text-slate-500">{[l.marca, l.city].filter(Boolean).join(" · ") || "Lokalizacja niepodana"}</p>
        {(l.sport || l.pregnancy) && <p className="text-xs text-indigo-700">{[sportLabel(l.sport), l.pregnancy ? "Odzież ciążowa" : null].filter(Boolean).join(" · ")}</p>}
        <p className="pt-1 text-lg font-semibold">{new Intl.NumberFormat("pl-PL").format(l.pricePerDay)} zł <span className="text-sm font-normal text-slate-500">/ dzień</span></p>
      </Link>
    </article>)}
  </div>;
}
