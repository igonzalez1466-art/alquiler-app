// app/listing/[id]/page.tsx
import { prisma } from "@/app/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/app/lib/auth";
import BookingForm from "./BookingForm";
import { startChatAction } from "./actions";
import { toggleListingAvailable } from "@/app/listing/actions";
import type { Estado, MetodoEnvio } from "@prisma/client";

/* ===================== TYPES ===================== */

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
};

/* ===================== LABELS ===================== */

const enumLabels: Record<string, string> = {
  WOMAN: "Kobieta",
  MAN: "Mężczyzna",
  UNISEX: "Unisex",
  KIDS: "Dziecko",

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
  ZAPATO: "Buty",
  OTRO: "Inne",
};

const labelEnum = (v?: string | null) => {
  if (!v) return "—";
  const key = v.trim().toUpperCase();
  return enumLabels[key] ?? v;
};

const estadoLabels: Record<Estado, string> = {
  NUEVO: "Nowy",
  COMO_NUEVO: "Jak nowy",
  USADO: "Używany",
  MUY_USADO: "Bardzo zużyty",
};

const envioLabels: Record<MetodoEnvio, string> = {
  RECOGIDA_LOCAL: "Odbiór osobisty",
  ENVIO_CORREOS: "Wysyłka pocztą",
  MENSAJERIA: "Kurier",
  OTRO: "Inne",
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

/* ===================== HELPERS ===================== */

function plOceny(n: number) {
  if (n === 1) return "ocena";
  if (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)) {
    return "oceny";
  }
  return "ocen";
}

function materialsToArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/* ===================== PAGE ===================== */

export default async function ListingDetail({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const error = sp.error;

  const [listing, session] = await Promise.all([
    prisma.listing.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        pricePerDay: true,
        city: true,
        postalCode: true,
        createdAt: true,
        userId: true,
        user: { select: { id: true, name: true } },
        estado: true,
        fianza: true,
        metodoEnvio: true,
        marca: true,
        available: true,
        images: true,
        gender: true,
        size: true,
        color: true,
        garmentType: true,
        materials: true,
      },
    }),
    getSession(),
  ]);

  if (!listing) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p>Ogłoszenie nie zostało znalezione.</p>
        <Link href="/listing" className="text-blue-600 underline">
          ← Wróć
        </Link>
      </div>
    );
  }

  const isOwner = session?.user?.id === listing.userId;

  const ownerStats = await prisma.review.aggregate({
    where: { revieweeId: listing.userId, role: "OWNER" },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const ownerAvg = ownerStats._avg.rating ?? 0;
  const ownerCount = ownerStats._count.rating ?? 0;

  const materials = materialsToArray(listing.materials);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link href="/listing" className="text-blue-600 underline">
          ← Wróć do ogłoszeń
        </Link>

        {!isOwner && (
          <form action={startChatAction}>
            <input type="hidden" name="listingId" value={listing.id} />
            <input type="hidden" name="ownerId" value={listing.userId} />
            <button
              type="submit"
              className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Otwórz czat
            </button>
          </form>
        )}
      </div>

      {error === "fechas-no-disponibles" && (
        <div className="border border-red-200 bg-red-50 p-2 text-sm text-red-800 rounded">
          Te daty nie są dostępne.
        </div>
      )}

      <h1 className="text-2xl font-bold">{listing.title}</h1>

      {listing.description ? (
        <p className="text-gray-700 whitespace-pre-wrap">{listing.description}</p>
      ) : (
        <p className="text-gray-400">Brak opisu.</p>
      )}

      <p className="text-sm text-gray-600">
        {listing.city ?? "—"} {listing.postalCode ? `(${listing.postalCode})` : ""}
      </p>

      <p>
        <strong>Stan:</strong> {listing.estado ? estadoLabels[listing.estado] : "—"}
      </p>

      <p>
        <strong>Dostawa:</strong>{" "}
        {listing.metodoEnvio ? envioLabels[listing.metodoEnvio] : "—"}
      </p>

      <p className="text-sm text-gray-500">
        Opublikowane przez{" "}
        <span className="font-medium">{listing.user?.name ?? "Użytkownik"}</span>{" "}
        ({new Date(listing.createdAt).toLocaleDateString("pl-PL")})
        {ownerCount > 0 && (
          <>
            {" • "}★ {ownerAvg.toFixed(1)} ({ownerCount} {plOceny(ownerCount)})
          </>
        )}
      </p>

      {/* ===== DETAILS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <strong>Marka:</strong> {listing.marca ?? "—"}
        </div>
        <div>
          <strong>Kategoria:</strong> {labelEnum(listing.garmentType)}
        </div>
        <div>
          <strong>Płeć:</strong> {labelEnum(listing.gender)}
        </div>
        <div>
          <strong>Rozmiar:</strong> {listing.size ?? "—"}
        </div>

        <div className="col-span-2 flex items-center gap-2">
          <strong>Kolor:</strong>
          <span
            className="inline-block h-4 w-4 rounded-full border"
            style={{
              backgroundColor: colorMap[(listing.color ?? "").toLowerCase()] ?? "transparent",
            }}
            title={listing.color ?? ""}
          />
          {listing.color ?? "—"}
        </div>

        <div className="col-span-2">
          <strong>Materiały:</strong> {materials.length ? materials.join(", ") : "—"}
        </div>
      </div>

      {/* ===== BOOKING ===== */}
      {!isOwner && (
        <BookingForm listingId={listing.id} isLoggedIn={!!session?.user?.id} />
      )}

      {/* ===== OWNER CONTROLS ===== */}
      {isOwner && (
        <div className="space-y-2">
          <div className="text-sm text-gray-700">
            Status:{" "}
            <strong>{listing.available ? "Aktywne" : "Nieaktywne"}</strong>
          </div>

          <form action={toggleListingAvailable}>
            <input type="hidden" name="listingId" value={listing.id} />
            <button
              type="submit"
              className={`px-4 py-2 rounded text-white ${
                listing.available ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {listing.available ? "Dezaktywuj" : "Aktywuj"} ogłoszenie
            </button>
          </form>
        </div>
      )}

      {/* ===== IMAGES ===== */}
      {listing.images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {listing.images
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((img) => (
              <div key={img.id} className="relative h-48 rounded overflow-hidden">
                <Image
                  src={img.url}
                  alt={img.alt ?? listing.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* ===================== SEO ===================== */

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { title: true, city: true, postalCode: true },
  });

  return {
    title: listing ? `${listing.title} | Ogłoszenia` : "Ogłoszenie",
    description: listing?.city
      ? listing.postalCode
        ? `Ogłoszenie w ${listing.city} (${listing.postalCode})`
        : `Ogłoszenie w ${listing.city}`
      : undefined,
  };
}
