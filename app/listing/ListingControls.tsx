"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sportLabel, accessoryLabel } from "@/app/lib/listingAttributes";

const labels: Record<string, string> = {q:"Szukaj",city:"Miasto",marca:"Marka",gender:"Dla kogo",garmentType:"Artykuł",accessoryType:"Akcesoria",size:"Rozmiar",color:"Kolor",materials:"Materiał",sport:"Sport",pregnancy:"Odzież ciążowa",min:"Cena od",max:"Cena do"};
const values: Record<string, string> = {WOMAN:"Kobieta",MAN:"Mężczyzna",UNISEX:"Uniseks",KIDS:"Dziecięce",ABRIGO:"Płaszcz",CHAQUETA:"Kurtka",MARYNARKA:"Marynarka",CAMISA:"Koszula",BLUSA:"Bluzka",VESTIDO:"Sukienka",PANTALON:"Spodnie",FALDA:"Spódnica",TRAJE:"Garnitur",SUDADERA:"Bluza",JERSEY:"Sweter",MONO:"Kombinezon",ACCESORIO:"Akcesoria",ZAPATO:"Buty",OTRO:"Inne",ANY:"Wszystkie sporty"};
export default function ListingControls({ filters, sort }: {filters: Record<string,string>;sort:string}) {
  const router = useRouter();
  const url = (change:Record<string,string>) => {
    const next = {...filters,...change};
    if (change.garmentType === "") next.accessoryType = "";
    if (change.gender === "") next.pregnancy = "";
    const query = new URLSearchParams(Object.entries(next).filter(([,v])=>v));
    return `/listing?${query.toString()}`;
  };
  return <div className="flex flex-wrap items-center justify-between gap-4">
    <div className="flex flex-wrap gap-2" aria-label="Wybrane filtry">
      {Object.entries(filters).filter(([key,value]) => labels[key] && value).map(([key,value]) => <Link key={key} href={url({[key]:""})} aria-label={`Usuń filtr: ${labels[key]}`} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-800">{labels[key]}{key === "pregnancy" ? "" : `: ${values[value] || (key === "sport" ? sportLabel(value) : key === "accessoryType" ? accessoryLabel(value) : null) || (key === "q" || key === "city" || key === "marca" || key === "size" ? value : value.toLowerCase().replaceAll("_"," "))}${key === "min" || key === "max" ? " zł" : ""}`} <span aria-hidden="true">×</span></Link>)}
    </div>
    <label className="flex items-center gap-2 text-sm text-slate-600">Sortuj
      <select value={sort} onChange={event=>router.push(url({sort:event.target.value}))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900">
        <option value="newest">Najnowsze</option><option value="price_asc">Cena: rosnąco</option><option value="price_desc">Cena: malejąco</option>
      </select>
    </label>
  </div>;
}
