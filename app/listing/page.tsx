// app/listing/page.tsx
import { prisma } from "@/app/lib/prisma";
import Link from "next/link";
import ListingExplorer from "./ListingExplorer";
import ListingControls from "./ListingControls";
import type { Prisma, Gender, GarmentType, Color } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { redirect } from "next/navigation";
import ListingFilters from "./ListingFilters";

import { isSportCode, isAccessoryCode } from "@/app/lib/listingAttributes";

/* ===================== LABELS ===================== */
const enumLabels: Record<string, string> = {
  WOMAN: "Kobieta",
  MAN: "Mężczyzna",
  UNISEX: "Uniseks",
  KIDS: "Dziecięcy",
  ABRIGO: "Płaszcz",
  CHAQUETA: "Kurtka",
  MARYNARKA: "Marynarka",
  ZAPATO: "Buty",
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
  OTRO: "Inne",
};

/* ===================== ALLOWED ENUM VALUES ===================== */
const ALLOWED_COLORS = new Set([
  "CZARNY",
  "BIALY",
  "SZARY",
  "BEZOWY",
  "BRAZOWY",
  "CZERWONY",
  "ROZOWY",
  "POMARANCZOWY",
  "ZOLTY",
  "ZIELONY",
  "NIEBIESKI",
  "GRANATOWY",
  "FIOLETOWY",
  "ZLOTY",
  "SREBRNY",
  "WIELOKOLOROWY",
]);

const ALLOWED_MATERIALS = new Set([
  "BAWELNA",
  "WELNA",
  "JEDWAB",
  "LEN",
  "POLIESTER",
  "AKRYL",
  "WISKOZA",
  "SKORA",
  "EKO_SKORA",
  "ZAMSZ",
  "DZINS",
  "LYCRA",
  "INNE",
]);

type Search = {
  tab?: "all" | "my";
  drafts?: string;
  status?: string;
  sort?: string;
  q?: string;
  category?: string;
  accessoryType?: string;
  city?: string;
  marca?: string;
  gender?: "WOMAN" | "MAN" | "UNISEX" | "KIDS";
  sport?: string;
  pregnancy?: string;
  garmentType?: keyof typeof enumLabels;
  size?: string;
  color?: string;
  materials?: string;
  min?: string;
  max?: string;
};

const parseNum = (v?: string) => {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

function toStringArray(v: unknown): string[] | null {
  if (!v) return null;

  if (Array.isArray(v)) {
    return v.filter((x) => typeof x === "string") as string[];
  }

  if (typeof v === "string") {
    // JSON string: '["BAWELNA","WELNA"]'
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.filter((x) => typeof x === "string") as string[];
      }
    } catch {
      // normal string: "BAWELNA"
      return [v];
    }
  }

  return null;
}

export default async function ListingPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const session = await getServerSession(authConfig);

  const p = (await searchParams) ?? {};
  const tab = p.tab === "my" ? "my" : "all";
  const status = tab === "my" ? (p.drafts === "1" || p.status === "drafts" ? "drafts" : p.status === "published" ? "published" : "all") : "all";
  const sort = p.sort === "price_asc" || p.sort === "price_desc" ? p.sort : "newest";
  const userId: string | undefined = session?.user?.id;


  // Si el usuario pide "my", debe estar logueado
  if (tab === "my" && !userId) {
    redirect("/login?callbackUrl=/listing?tab=my");
  }

  /* ======================= FILTROS ======================= */
  const q = (p.q ?? "").trim();
  const city = (p.city ?? "").trim();
  const marca = (p.marca ?? "").trim();
  const gender = p.gender && ["WOMAN","MAN","UNISEX","KIDS"].includes(p.gender) ? p.gender : undefined;
  const sportRaw = (p.sport ?? "").trim();
  const sport = sportRaw === "ANY" || isSportCode(sportRaw) ? sportRaw : "";
  const pregnancy = p.pregnancy === "1";
  const size = (p.size ?? "").trim();

  const colorRaw = String(p.color ?? "").trim();
  const materialRaw = String(p.materials ?? "").trim();

  const color = ALLOWED_COLORS.has(colorRaw) ? colorRaw : undefined;
  const material = ALLOWED_MATERIALS.has(materialRaw) ? materialRaw : undefined;

  const category = (p.category ?? "").trim().toLowerCase();
  const categoryToGarmentType: Record<string, keyof typeof enumLabels> = {
    sukienki: "VESTIDO",
    garnitur: "TRAJE",
    akcesoria: "ACCESORIO",
  };

  const garmentRaw = p.garmentType ?? (category ? categoryToGarmentType[category] : undefined);
  const garmentType = garmentRaw && Object.keys(enumLabels).filter(key => !["WOMAN","MAN","UNISEX","KIDS"].includes(key)).includes(garmentRaw) ? garmentRaw as GarmentType : undefined;

  const accessoryType = garmentType === "ACCESORIO" && isAccessoryCode(p.accessoryType ?? "") ? p.accessoryType : undefined;
  const min = parseNum(p.min);
  const max = parseNum(p.max);

  /* ======================= WHERE ======================= */
  const where: Prisma.ListingWhereInput = {};
  const AND: Prisma.ListingWhereInput[] = [];

  if (tab === "all") {
    where.available = true;
    where.isDraft = false;
  }

  if (tab === "my") {
    where.userId = userId;
    if (status === "drafts") where.isDraft = true;
    if (status === "published") where.isDraft = false;
    // where.available = true; // opcional
  }

  if (q) {
    AND.push({
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { marca: { contains: q } },
        { city: { contains: q } },
        { postalCode: { contains: q } },
        { otherGarmentType: { contains: q } },
        { otherAccessoryType: { contains: q } },
        { otherSport: { contains: q } },
      ],
    });
  }

  if (city) {
    AND.push({
      OR: [{ city: { contains: city } }, { postalCode: { contains: city } }],
    });
  }

  if (marca) AND.push({ marca: { contains: marca } });
  if (gender) AND.push({ gender: gender as Gender });
  if (sport === "ANY") AND.push({ sport: { not: null } });
  else if (sport) AND.push({ sport });
  if (pregnancy) AND.push({ pregnancy: true });
  if (garmentType) AND.push({ garmentType });
  if (accessoryType) AND.push({ accessoryType });
  if (size) AND.push({ size });
  if (color) AND.push({ color: color as Color });

  if (min !== undefined || max !== undefined) {
    AND.push({
      pricePerDay: { gte: min ?? 0, lte: max ?? 1_000_000 },
    });
  }

  if (material) {
    AND.push({
      materials: {
        string_contains: `"${material}"`,
      },
    });
  }

  if (AND.length) where.AND = AND;

  /* ======================= QUERY ======================= */
  const listingsRaw = await prisma.listing.findMany({
    where,
    orderBy: sort === "newest" ? [{ createdAt: "desc" }, { id: "desc" }] : [{ pricePerDay: sort === "price_asc" ? "asc" : "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      available: true,
      isDraft: true,
      pricePerDay: true,
      city: true,
      postalCode: true,
      lat: true,
      lng: true,
      marca: true,
      gender: true,
      sport: true,
      otherGarmentType: true,
      otherAccessoryType: true,
      otherSport: true,
      pregnancy: true,
      size: true,
      color: true,
      garmentType: true,
      accessoryType: true,
      materials: true,
      images: {
        select: { id: true, url: true, alt: true, order: true },
        orderBy: { order: "asc" },
      },
    },
  });

  // ✅ Normaliza materials a string[] | null para ListingResults
  const listings = listingsRaw.map((l) => ({
    ...l,
    materials: toStringArray(l.materials),
  }));

  const markers = listings
    .filter((l) => l.lat !== null && l.lng !== null)
    .map((l) => ({
      id: l.id,
      title: l.title,
      lat: l.lat as number,
      lng: l.lng as number,
      pricePerDay: l.pricePerDay,
      city: l.city ?? undefined,
      imageUrl: l.images[0]?.url ?? null,
      imageAlt: l.images[0]?.alt ?? l.title,
    }));

  const filterValues = {tab, status: tab === "my" ? status : "", sort, q, city, marca, gender: gender ?? "", sport, pregnancy: pregnancy ? "1" : "", garmentType: garmentType ?? "", accessoryType: accessoryType ?? "", size, color: color ?? "", materials: material ?? "", min: min === undefined ? "" : String(min), max: max === undefined ? "" : String(max)};
  return <div className="mx-auto max-w-7xl space-y-6 pb-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-violet-700">{tab === "my" ? "Twoja szafa" : "Odkryj coś dla siebie"}</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{tab === "my" ? "Moje ogłoszenia" : "Znajdź swój następny look"}</h1><p className="mt-2 text-sm text-slate-500">{tab === "my" ? "Zarządzaj publikacjami i przygotuj nowe ogłoszenia." : "Wypożycz na wyjątkową okazję. Znajdź coś w swojej okolicy."}</p></div>
      <Link href="/listing/new" className="ui-btn ui-btn-primary">+ Dodaj ogłoszenie</Link>
    </header>
    <nav className="flex flex-wrap gap-2" aria-label="Ogłoszenia">
      <Link href="/listing" aria-current={tab === "all" ? "page" : undefined} className={"ui-btn " + (tab === "all" ? "bg-violet-50 text-violet-800 border-violet-200" : "bg-white")}>Wszystkie ogłoszenia</Link>
      <Link href="/listing?tab=my" aria-current={tab === "my" ? "page" : undefined} className={"ui-btn " + (tab === "my" ? "bg-violet-50 text-violet-800 border-violet-200" : "bg-white")}>Moje ogłoszenia</Link>
    </nav>
    {tab === "my" && <nav className="flex gap-2 border-b border-slate-200" aria-label="Status ogłoszeń">{[["all","Wszystkie"],["published","Opublikowane"],["drafts","Szkice"]].map(([value,label])=><Link key={value} href={"/listing?tab=my&status="+value} aria-current={status === value ? "page" : undefined} className={"border-b-2 px-4 py-3 text-sm font-semibold " + (status === value ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500")}>{label}</Link>)}</nav>}
    <ListingFilters key={JSON.stringify(filterValues)} {...filterValues} pregnancy={pregnancy} />
    {min !== undefined && max !== undefined && min > max && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Cena minimalna nie może być wyższa od maksymalnej. Popraw zakres cen.</p>}
    <ListingControls filters={filterValues} sort={sort} />
    <ListingExplorer listings={listings} markers={markers} showStatus={tab === "my"} />
  </div>;
}
