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

const badge = (label: string, cls: string) => (
  <span className={`text-xs px-2 py-1 rounded border ${cls}`}>{label}</span>
);

// ===== Etiquetas =====
const statusLabel: Record<string, string> = {
  PENDING: "Oczekuje na akceptację",
  AWAITING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  CANCELLED: "Odrzucona",
};

const statusClass: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  AWAITING_PAYMENT: "bg-blue-100 text-blue-800 border-blue-200",
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
};

const shippingLabel: Record<string, string> = {
  NOT_REQUIRED: "No requiere envío",
  PENDING: "Oczekuje na przygotowanie",
  READY: "Listo para envío",
  SHIPPED: "En tránsito",
  DELIVERED: "Dostarczono",
  RETURN_PENDING: "Devolución pendiente",
  RETURNED: "Devuelto",
  LOST: "Perdido o dañado",
  CANCELLED: "Cancelado",
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
              {booking.listing?.title ?? "Anuncio"}
            </Link>
            <div className="text-sm text-gray-600 mt-1">
              {fmt(booking.startDate)} — {fmt(booking.endDate)}
            </div>
            <div className="text-sm text-gray-500">
              Najemca:{" "}
              <span className="font-medium">{booking.renter?.name ?? "Usuario"}</span>{" "}
              <span className="text-gray-400">
                ({booking.renter?.email ?? "sin email"})
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
            <span className="text-gray-500">Przewoźnik:</span> {booking.carrier ?? "—"}
          </div>
          <div>
            <span className="text-gray-500">Numer śledzenia:</span>{" "}
            {booking.trackingNumber ?? "—"}
          </div>
          <div>
            <span className="text-gray-500">Wysłano dnia:</span> {fmt(booking.shippedAt)}
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
