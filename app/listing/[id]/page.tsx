// app/listing/[id]/page.tsx
import { prisma } from "@/app/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
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

const pill = (text: string, cls = "bg-gray-50 text-gray-700 border-gray-200") => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${cls}`}>
    {text}
  </span>
);

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

  const colorBg = colorMap[(listing.color ?? "").toLowerCase()] ?? "transparent";

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/listing" className="text-blue-600 underline">
          ← Wróć do ogłoszeń
        </Link>

        {!isOwner && (
          <form action={startChatAction}>
            <input type="hidden" name="listingId" value={listing.id} />
            <input type="hidden" name="ownerId" value={listing.userId} />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
            >
              Otwórz czat
            </button>
          </form>
        )}
      </div>

      {error === "fechas-no-disponibles" && (
        <div className="mb-6 border border-red-200 bg-red-50 p-3 text-sm text-red-800 rounded-lg">
          Te daty nie są dostępne.
        </div>
      )}

      {/* Layout: content + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT: main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <section className="border rounded-xl bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold truncate">
                    {listing.title}
                  </h1>

                  <div className="mt-1 text-sm text-gray-600">
                    {listing.city ?? "—"}{" "}
                    {listing.postalCode ? `(${listing.postalCode})` : ""}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {listing.estado && pill(`Stan: ${estadoLabels[listing.estado]}`)}
                  {listing.metodoEnvio && pill(`Dostawa: ${envioLabels[listing.metodoEnvio]}`)}
                  {pill(listing.available ? "Aktywne" : "Nieaktywne", listing.available
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200")}
                </div>
              </div>

              <div className="text-sm text-gray-500">
                Opublikowane przez{" "}
                <span className="font-medium text-gray-700">
                  {listing.user?.name ?? "Użytkownik"}
                </span>{" "}
                ({new Date(listing.createdAt).toLocaleDateString("pl-PL")})
                {ownerCount > 0 && (
                  <>
                    {" • "}★ {ownerAvg.toFixed(1)} ({ownerCount} {plOceny(ownerCount)})
                  </>
                )}
              </div>

              {listing.description ? (
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {listing.description}
                </p>
              ) : (
                <p className="text-gray-400">Brak opisu.</p>
              )}
            </div>
          </section>

          {/* Details as chips */}
          <section className="border rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Szczegóły</h2>

            <div className="flex flex-wrap gap-2">
              {pill(`Marka: ${listing.marca ?? "—"}`)}
              {pill(`Kategoria: ${labelEnum(listing.garmentType)}`)}
              {pill(`Płeć: ${labelEnum(listing.gender)}`)}
              {pill(`Rozmiar: ${listing.size ?? "—"}`)}

              <span className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs bg-gray-50 text-gray-700 border-gray-200">
                Kolor:
                <span
                  className="inline-block h-3 w-3 rounded-full border"
                  style={{ backgroundColor: colorBg }}
                  title={listing.color ?? ""}
                />
                {listing.color ?? "—"}
              </span>

              {pill(
                `Materiały: ${materials.length ? materials.join(", ") : "—"}`
              )}
            </div>
          </section>

          {/* Images */}
          {listing.images.length > 0 && (
            <section className="border rounded-xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold mb-3">Zdjęcia</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {listing.images
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((img) => (
                    <div key={img.id} className="relative h-44 md:h-48 rounded-lg overflow-hidden">
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
            </section>
          )}

          {/* Owner controls (left bottom) */}
          {isOwner && (
            <section className="border rounded-xl bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-lg font-semibold">Panel właściciela</h2>

              <div className="text-sm text-gray-700">
                Status ogłoszenia:{" "}
                <strong>{listing.available ? "Aktywne" : "Nieaktywne"}</strong>
              </div>

              <form action={toggleListingAvailable}>
                <input type="hidden" name="listingId" value={listing.id} />
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-lg text-white transition ${
                    listing.available
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {listing.available ? "Dezaktywuj" : "Aktywuj"} ogłoszenie
                </button>
              </form>
            </section>
          )}
        </div>

        {/* RIGHT: sidebar */}
        <aside className="lg:col-span-1 space-y-4 lg:sticky lg:top-6">
          {/* Price card */}
          <section className="border rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Cena</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs text-gray-600">Cena za dzień</div>
                <div className="text-2xl font-bold text-gray-900">
                  {listing.pricePerDay} zł
                </div>
              </div>

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs text-gray-600">Kaucja</div>
                <div className="text-2xl font-bold text-gray-900">
                  {listing.fianza != null ? `${listing.fianza} zł` : "—"}
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-600">
              Kaucja jest zwrotna zgodnie z warunkami (po zwrocie produktu i potwierdzeniu braku uszkodzeń).
            </p>
          </section>

          {/* Booking (only not owner) */}
          {!isOwner && (
            <section className="border rounded-xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold mb-3">Rezerwacja</h2>
              <BookingForm
                listingId={listing.id}
                isLoggedIn={!!session?.user?.id}
                pricePerDay={listing.pricePerDay}
                fianza={listing.fianza ?? 0}
              />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ===================== SEO ===================== */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
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
