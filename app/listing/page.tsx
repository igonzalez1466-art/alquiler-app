// app/listing/page.tsx
import { prisma } from "@/app/lib/prisma";
import Link from "next/link";
import MapClient from "./MapClient";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { redirect } from "next/navigation";
import ListingFilters from "./ListingFilters";
import ListingResults from "./ListingResults";

/* ===================== LABELS ===================== */
const enumLabels: Record<string, string> = {
  WOMAN: "Kobieta",
  MAN: "Mężczyzna",
  UNISEX: "Uniseks",
  KIDS: "Dziecięcy",
  ABRIGO: "Płaszcz",
  CHAQUETA: "Marynarka",
  CAMISA: "Koszula",
  BLUSA: "Bluzka",
  VESTIDO: "Sukienka",
  PANTALON: "Spodnie",
  FALDA: "Spódnica",
  TRAJE: "Garnitur",
  SUDADERA: "Bluza",
  JERSEY: "Sweter",
  MONO: "Kombinezon",
  CHAMARRA: "Kurtka",
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
  q?: string;
  category?: string;
  city?: string;
  marca?: string;
  gender?: "WOMAN" | "MAN" | "UNISEX" | "KIDS";
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
  return Number.isFinite(n) ? n : undefined;
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
  const session: any = await getServerSession(authConfig as any);

  const p = (await searchParams) ?? {};
  const tab = p.tab ?? "all";
  const userId: string | undefined = session?.user?.id;


  // Si el usuario pide "my", debe estar logueado
  if (tab === "my" && !userId) {
    redirect("/login?callbackUrl=/listing?tab=my");
  }

  /* ======================= FILTROS ======================= */
  const q = (p.q ?? "").trim();
  const city = (p.city ?? "").trim();
  const marca = (p.marca ?? "").trim();
  const gender = p.gender;
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

  const garmentType =
    p.garmentType ?? (category ? categoryToGarmentType[category] : undefined);

  const min = parseNum(p.min);
  const max = parseNum(p.max);

  /* ======================= WHERE ======================= */
  const where: any = {};
  const AND: any[] = [];

  if (tab === "all") {
    where.available = true;
  }

  if (tab === "my") {
    where.userId = userId;
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
      ],
    });
  }

  if (city) {
    AND.push({
      OR: [{ city: { contains: city } }, { postalCode: { contains: city } }],
    });
  }

  if (marca) AND.push({ marca: { contains: marca } });
  if (gender) AND.push({ gender });
  if (garmentType) AND.push({ garmentType });
  if (size) AND.push({ size });
  if (color) AND.push({ color });

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
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      pricePerDay: true,
      city: true,
      postalCode: true,
      lat: true,
      lng: true,
      marca: true,
      gender: true,
      size: true,
      color: true,
      garmentType: true,
      materials: true,
      images: {
        select: { id: true, url: true, alt: true, order: true },
        orderBy: { order: "asc" },
        take: 4,
      },
    },
  });

  // ✅ Normaliza materials a string[] | null para ListingResults
  const listings = listingsRaw.map((l) => ({
    ...l,
    materials: toStringArray((l as any).materials),
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

  return (
    <div className="max-w-5xl mx-auto mt-10 space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex gap-2">
          <Link
            href="/listing/new"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Dodaj ogłoszenie
          </Link>

          <Link
            href="/listing?tab=my"
            className={`border px-4 py-2 rounded bg-white ${
              tab === "my" ? "ring-2 ring-blue-500" : ""
            }`}
          >
            Moje ogłoszenia
          </Link>
        </div>
      </div>

      <ListingFilters
        q={q}
        city={city}
        marca={marca}
        gender={gender}
        garmentType={garmentType}
        size={size}
        color={color ?? ""}
        materials={material ?? ""}
      />

      <div className="relative">
        <MapClient markers={markers} />

        {markers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 border rounded px-4 py-2 text-sm text-gray-700 shadow">
              Brak ogłoszeń dla tego wyszukiwania.
            </div>
          </div>
        )}
      </div>

      <ListingResults listings={listings as any} />
    </div>
  );
}
