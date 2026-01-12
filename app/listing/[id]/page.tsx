// app/listing/[id]/page.tsx
import { prisma } from "@/app/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { startChatAction } from "./actions";
import BookingForm from "./BookingForm";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { toggleListingAvailable } from "@/app/listing/actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>; // ✅ Next 15: también Promise
};

// Etiquetas legibles para enums (polaco, pero claves siguen en español)
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
const label = (v?: string | null) => {
  const key = (v ?? "").trim().toUpperCase();
  return key ? enumLabels[key] ?? key : "—";
};

// Estado del artículo (en DB: NUEVO, COMO_NUEVO, USADO, MUY_USADO)
const estadoLabels: Record<string, string> = {
  NUEVO: "Nowy",
  COMO_NUEVO: "Jak nowy",
  USADO: "Używany",
  MUY_USADO: "Bardzo zużyty",
};
const labelEstado = (v?: string | null) => (v ? estadoLabels[v] ?? v : "—");

// Método de envío (en DB: RECOGIDA_LOCAL, ENVIO_CORREOS, MENSAJERIA, OTRO)
const envioLabels: Record<string, string> = {
  RECOGIDA_LOCAL: "Odbiór osobisty",
  ENVIO_CORREOS: "Wysyłka pocztą",
  MENSAJERIA: "Kurier",
  OTRO: "Inne",
};
const labelEnvio = (v?: string | null) => (v ? envioLabels[v] ?? v : "—");

// Colores para el swatch
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

// ✅ plural polaco: ocena/oceny/ocen
function plOceny(n: number) {
  if (n === 1) return "ocena";
  if (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)) {
    return "oceny";
  }
  return "ocen";
}

export default async function ListingDetail({ params, searchParams }: PageProps) {
  const { id } = await params;

  // ✅ leer searchParams (Next 15)
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
        // Nuevos campos
        gender: true,
        size: true,
        color: true,
        garmentType: true,
        materials: true,
      },
    }),
    getServerSession(authConfig),
  ]);

  if (!listing) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="mb-4">Ogłoszenie nie zostało znalezione.</p>
        <Link href="/listing" className="text-blue-600 underline">
          ← Wróć do ogłoszeń
        </Link>
      </div>
    );
  }

  // ✅ rating del dueño (opiniones SOBRE el dueño como OWNER)
  const ownerStats = await prisma.review.aggregate({
    where: { revieweeId: listing.userId, role: "OWNER" },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const ownerAvg = ownerStats._avg.rating ?? 0;
  const ownerCount = ownerStats._count.rating ?? 0;

  const isOwner = (session?.user as any)?.id === listing.userId;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      {/* Encabezado y chat */}
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

      {/* ✅ Mensajes de error (por querystring) */}
      {error === "fechas-no-disponibles" && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Te daty nie są dostępne. Wybierz inne.
        </div>
      )}

      <h1 className="text-2xl font-bold">{listing.title}</h1>

      {/* Información principal */}
      <div className="text-gray-700 space-y-1">
        {listing.description && <p>{listing.description}</p>}

        <p>
          <strong>Miasto:</strong> {listing.city ?? "—"}
          {listing.postalCode ? ` (${listing.postalCode})` : ""}
        </p>
        <p>
          <strong>Stan:</strong> {labelEstado(listing.estado as any)}
        </p>

        <p>
          <strong>Preferowana metoda dostawy:</strong>{" "}
          {labelEnvio(listing.metodoEnvio as any)}
        </p>

        {/* ✅ owner + rating */}
        <p className="text-sm text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            Opublikowane przez{" "}
            <span className="font-medium text-gray-700">
              {listing.user?.name ?? "Użytkownik"}
            </span>{" "}
            dnia {new Date(listing.createdAt).toLocaleDateString("pl-PL")}
          </span>

          {ownerCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-gray-600">
              <span aria-hidden>★</span>
              <span className="font-medium">{ownerAvg.toFixed(1)}</span>
              <span className="text-gray-400">
                ({ownerCount} {plOceny(ownerCount)})
              </span>
            </span>
          ) : (
            <span className="text-xs text-gray-400">(Brak ocen)</span>
          )}
        </p>
      </div>

      {/* ================== ESPECIFICACIONES ================== */}
      <section className="mt-4">
        <h3 className="font-semibold mb-3">Szczegóły</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-xl border bg-white px-3 py-2">
            <p className="text-xs text-gray-500">Marka</p>
            <p className="text-sm">{listing.marca ?? "—"}</p>
          </div>

          <div className="rounded-xl border bg-white px-3 py-2">
            <p className="text-xs text-gray-500">Kategoria</p>
            <p className="text-sm">{label(listing.garmentType as any)}</p>
          </div>

          <div className="rounded-xl border bg-white px-3 py-2">
            <p className="text-xs text-gray-500">Płeć</p>
            <p className="text-sm">{label(listing.gender as any)}</p>
          </div>

          <div className="rounded-xl border bg-white px-3 py-2">
            <p className="text-xs text-gray-500">Rozmiar</p>
            <p className="text-sm">{listing.size ?? "—"}</p>
          </div>

          <div className="rounded-xl border bg-white px-3 py-2 col-span-2 md:col-span-2 min-h-[72px] flex flex-col justify-center">
            <p className="text-xs text-gray-500">Kolor</p>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border"
                style={{
                  backgroundColor:
                    colorMap[(listing.color ?? "").toLowerCase()] ?? "transparent",
                }}
                title={listing.color ?? ""}
              />
              <p className="text-sm">{listing.color ?? "—"}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-white px-3 py-2 col-span-2 md:col-span-2 min-h-[72px] flex flex-col justify-center">
            <p className="text-xs text-gray-500 mb-1">Materiały</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.isArray(listing.materials) && (listing.materials as string[]).length ? (
                (listing.materials as string[]).map((m) => (
                  <span
                    key={m}
                    className="text-xs rounded-full border px-2 py-1 bg-gray-50"
                  >
                    {m}
                  </span>
                ))
              ) : (
                <span className="text-sm">—</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Formulario de reserva */}
      {!isOwner && (
        <BookingForm
          listingId={listing.id}
          pricePerDay={listing.pricePerDay}
          fianza={listing.fianza}
          isLoggedIn={!!session?.user}
        />
      )}

      {/* ================== OWNER CONTROLS ================== */}
      {isOwner && (
        <div className="bg-amber-50 border border-amber-200 rounded px-3 py-3 space-y-2">
          <p className="text-sm text-amber-800">
            To ogłoszenie jest Twoje. Status:{" "}
            <strong>{listing.available ? "Aktywne" : "Nieaktywne"}</strong>
          </p>

          <form action={toggleListingAvailable}>
            <input type="hidden" name="listingId" value={listing.id} />
            <button
              type="submit"
              className={`px-4 py-2 rounded text-sm font-medium ${
                listing.available
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {listing.available ? "Dezaktywuj ogłoszenie" : "Aktywuj ogłoszenie"}
            </button>
          </form>
        </div>
      )}

      {/* Galería */}
      {listing.images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {listing.images
            .sort((a, b) => a.order - b.order)
            .map((img) => (
              <div
                key={img.id}
                className="relative w-full h-48 rounded overflow-hidden"
              >
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

// SEO dinámico
export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { title: true, city: true, postalCode: true },
  });
  const baseTitle = listing ? `${listing.title} | Ogłoszenia` : "Ogłoszenie | Ogłoszenia";
  const desc = listing?.city
    ? listing.postalCode
      ? `Ogłoszenie w ${listing.city} (${listing.postalCode})`
      : `Ogłoszenie w ${listing.city}`
    : undefined;

  return { title: baseTitle, description: desc };
}
