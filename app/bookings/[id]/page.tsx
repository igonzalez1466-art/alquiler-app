// app/bookings/[id]/page.tsx
import { prisma } from "@/app/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/app/lib/auth";
import { ApproveButton } from "../_components/ApproveButton";
import RejectButton from "../_components/RejectButton";

// ===== Helpers =====
const fmt = (d?: Date | null) =>
  d
    ? d.toLocaleString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const fmtDate = (d?: Date | null) =>
  d
    ? d.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

const badge = (label: string, cls: string) => (
  <span className={`text-xs px-2 py-1 rounded border ${cls}`}>{label}</span>
);

function daysInclusive(a: Date, b: Date) {
  const start = new Date(a);
  start.setHours(0, 0, 0, 0);
  const end = new Date(b);
  end.setHours(0, 0, 0, 0);
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

// ===== Etiquetas =====
const statusLabel: Record<string, string> = {
  PENDING: "Oczekuje na akceptację",
  AWAITING_PAYMENT: "Oczekuje na płatność",
  PAID: "Opłacona",
  CANCELLED: "Odrzucona",
};

const statusClass: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  AWAITING_PAYMENT: "bg-blue-100 text-blue-800 border-blue-200",
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
};

const shippingLabel: Record<string, string> = {
  NOT_REQUIRED: "Nie wymaga wysyłki",
  PENDING: "Oczekuje na przygotowanie",
  READY: "Gotowe do wysyłki",
  SHIPPED: "W drodze",
  DELIVERED: "Dostarczono",
  RETURN_PENDING: "Zwrot w toku",
  RETURNED: "Zwrócono",
  LOST: "Zgubione lub uszkodzone",
  CANCELLED: "Anulowane",
};

const shippingClass: Record<string, string> = {
  NOT_REQUIRED: "bg-gray-100 text-gray-700 border-gray-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  READY: "bg-sky-100 text-sky-800 border-sky-200",
  SHIPPED: "bg-blue-100 text-blue-800 border-blue-200",
  DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  RETURN_PENDING: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
  RETURNED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  LOST: "bg-rose-100 text-rose-700 border-rose-200",
  CANCELLED: "bg-gray-100 text-gray-700 border-gray-200",
};

// ===== Traducciones método de entrega =====
const metodoEnvioLabel: Record<string, string> = {
  RECOGIDA_LOCAL: "Odbiór osobisty",
  ENVIO_CORREOS: "Wysyłka pocztą",
  MENSAJERIA: "Kurier",
  OTRO: "Inna metoda",
};

export default async function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  const userId = session?.user?.id ?? null;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          metodoEnvio: true,
          fianza: true,
          pricePerDay: true, // ✅ AÑADIDO
          userId: true,
        },
      },
      renter: { select: { id: true, name: true, email: true } },
      reviews: {
        select: {
          id: true,
          reviewerId: true,
          revieweeId: true,
          rating: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!booking) return notFound();

  const isOwner = !!userId && booking.listing?.userId === userId;

  // ===== Cálculos pago =====
  const pricePerDay = booking.listing?.pricePerDay ?? 0;
  const deposit = booking.listing?.fianza ?? 0;
  const days = daysInclusive(booking.startDate, booking.endDate);
  const rentTotal = days > 0 ? days * pricePerDay : 0;
  const total = rentTotal + deposit;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Szczegóły rezerwacji</h1>
        <Link href="/bookings" className="text-blue-600 underline">
          ← Wróć
        </Link>
      </div>

      {/* ===== Información general ===== */}
      <section className="p-4 border rounded bg-white space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">Ogłoszenie</div>
            <Link
              href={`/listing/${booking.listingId}`}
              className="text-blue-700 hover:underline font-medium"
            >
              {booking.listing?.title ?? "Ogłoszenie"}
            </Link>
            <div className="text-sm text-gray-600 mt-1">
              {fmt(booking.startDate)} — {fmt(booking.endDate)}
            </div>
            <div className="text-sm text-gray-500">
              Najemca:{" "}
              <span className="font-medium">
                {booking.renter?.name ?? "Użytkownik"}
              </span>
            </div>
          </div>
          {badge(
            statusLabel[booking.status] ?? booking.status,
            statusClass[booking.status] ??
              "bg-gray-100 text-gray-800 border-gray-200"
          )}
        </div>
      </section>

      {/* ===== Płatność ===== */}
      <section className="border rounded bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h2 className="text-lg font-semibold">Płatność</h2>
          <p className="text-xs text-gray-600">
            Podsumowanie kosztów rezerwacji
          </p>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-gray-500">Od</div>
              <div className="font-semibold">{fmtDate(booking.startDate)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-gray-500">Do</div>
              <div className="font-semibold">{fmtDate(booking.endDate)}</div>
            </div>
          </div>

          <div className="rounded-lg border">
            <div className="divide-y">
              <div className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-gray-600">Liczba dni</span>
                <span className="font-medium">{days}</span>
              </div>

              <div className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-gray-600">Cena za dzień</span>
                <span className="font-medium">{pricePerDay} zł</span>
              </div>

              <div className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-gray-600">Koszt najmu</span>
                <span className="font-medium">{rentTotal} zł</span>
              </div>

              <div className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-gray-600">
                  Kaucja <span className="text-xs text-gray-500">(zwrotna)</span>
                </span>
                <span className="font-medium">{deposit} zł</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-indigo-50 border-indigo-100 px-3 py-3 flex items-center justify-between">
            <span className="font-semibold text-gray-900">Razem do zapłaty</span>
            <span className="text-lg font-bold text-indigo-700">{total} zł</span>
          </div>

          <div className="rounded-lg bg-gray-50 border px-3 py-2 text-xs text-gray-700">
            Kaucja jest zwrotna zgodnie z warunkami (po zwrocie produktu i
            potwierdzeniu braku uszkodzeń).
          </div>
        </div>
      </section>

      {/* ===== Envío ===== */}
      <section className="p-4 border rounded bg-white space-y-3">
        <h2 className="text-lg font-semibold">Wysyłka</h2>

        <div className="flex flex-wrap items-center gap-2">
          {badge(
            shippingLabel[booking.shippingStatus] ?? booking.shippingStatus,
            shippingClass[booking.shippingStatus] ??
              "bg-gray-100 text-gray-800 border-gray-200"
          )}

          <span className="text-sm text-gray-600">
            Preferowana metoda dostawy:{" "}
            <strong>
              {booking.listing?.metodoEnvio
                ? metodoEnvioLabel[booking.listing.metodoEnvio] ??
                  booking.listing.metodoEnvio
                : "—"}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Przewoźnik:</span>{" "}
            {booking.carrier ?? "—"}
          </div>
          <div>
            <span className="text-gray-500">Numer śledzenia:</span>{" "}
            {booking.trackingNumber ?? "—"}
          </div>
          <div>
            <span className="text-gray-500">Wysłano dnia:</span>{" "}
            {fmt(booking.shippedAt)}
          </div>
          <div>
            <span className="text-gray-500">Dostarczono dnia:</span>{" "}
            {fmt(booking.deliveredAt)}
          </div>
        </div>
      </section>

      {/* ===== Acciones (solo propietario) ===== */}
      {isOwner && booking.status === "PENDING" && (
        <section className="p-4 border rounded bg-white space-y-3">
          <h2 className="text-lg font-semibold">Akcje</h2>
          <div className="flex gap-3">
            <ApproveButton bookingId={id} />
            <RejectButton bookingId={id} />
          </div>
        </section>
      )}
    </div>
  );
}
