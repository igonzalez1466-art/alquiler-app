"use client";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { toggleListingAvailable } from "./actions";
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


export type Listing = {
  id: string;
  title: string;
  available: boolean;
  isDraft?: boolean;
  city: string | null;
  postalCode: string | null;
  pricePerDay: number; // ✅ PRECIO DIARIO
  marca: string | null;
  gender: string | null;
  sport: string | null;
  otherGarmentType?: string | null;
  otherAccessoryType?: string | null;
  otherSport?: string | null;
  pregnancy: boolean;
  size: string | null;
  color: string | null;
  garmentType: string | null;
  accessoryType?: string | null;
  materials: string[] | null;
  images: { id: string; url: string; alt: string | null }[];
};


function AvailabilityButton({ listing }: {listing: Listing}) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="ui-btn flex-1 text-xs disabled:opacity-50" type="submit">{pending ? "Zapisywanie…" : listing.isDraft ? "Opublikuj" : listing.available ? "Dezaktywuj" : "Aktywuj"}</button>;
}
export default function ListingResults({ listings, showStatus = false, compact = false }: { listings: Listing[]; showStatus?: boolean; compact?: boolean }) {
  if (!listings.length) return <div className="surface-card p-10 text-center"><h2 className="text-lg font-semibold">Brak pasujących ogłoszeń</h2><p className="mt-2 text-sm text-slate-500">Zmień filtry lub poszerz zakres wyszukiwania.</p><Link href={showStatus ? "/listing?tab=my" : "/listing"} className="ui-btn mt-5">Wyczyść filtry</Link>{showStatus && <Link href="/listing/new" className="ui-btn ui-btn-primary mt-5 ml-2">Dodaj ogłoszenie</Link>}</div>;
  return <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${compact ? "" : "lg:grid-cols-3"}`} aria-label="Ogłoszenia">
    {listings.map(l => <article key={l.id} className="surface-card group overflow-hidden transition hover:border-violet-200 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
      <div className="relative">
        <ListingPhotoGallery cover photos={l.images} title={l.title} />
        {showStatus && <span className={`pointer-events-none absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${l.available ? "bg-white text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{l.isDraft ? "Szkic — prywatny" : l.available ? "Aktywne" : "Nieaktywne"}</span>}
      </div>
      <Link href={`/listing/${l.id}`} className="block space-y-2.5 p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
        <p className="text-xs text-slate-500">{(l.garmentType === "OTRO" ? l.otherGarmentType : l.accessoryType === "INNE" ? l.otherAccessoryType : null) || accessoryLabel(l.accessoryType) || label(l.garmentType)}{l.size ? ` · Rozmiar ${l.size}` : ""}</p>
        <h2 className="line-clamp-2 font-semibold text-slate-900 group-hover:text-violet-700">{l.title}</h2>
        <p className="text-sm text-slate-500">{[l.marca, l.city].filter(Boolean).join(" · ") || "Lokalizacja niepodana"}</p>
        {(l.sport || l.pregnancy) && <p className="text-xs text-indigo-700">{[l.sport === "INNY" ? l.otherSport || sportLabel(l.sport) : sportLabel(l.sport), l.pregnancy ? "Odzież ciążowa" : null].filter(Boolean).join(" · ")}</p>}
        <p className="border-t border-slate-100 pt-3 text-xl font-semibold text-slate-900">{new Intl.NumberFormat("pl-PL").format(l.pricePerDay)} zł <span className="text-sm font-normal text-slate-500">/ dzień</span></p>
      </Link>
      {showStatus && <div className="flex gap-2 border-t border-slate-100 px-4 py-3"><Link className="ui-btn flex-1 text-xs" href={`/listing/${l.id}`}>Otwórz</Link><form className="flex flex-1" action={toggleListingAvailable}><input type="hidden" name="listingId" value={l.id} /><input type="hidden" name="returnTo" value="my" /><AvailabilityButton listing={l} /></form></div>}
    </article>)}
  </div>;
}
