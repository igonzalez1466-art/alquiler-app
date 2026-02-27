// app/bookings/[id]/page.tsx
import { prisma } from "@/app/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/app/lib/auth";
import { ApproveButton } from "../_components/ApproveButton";
import RejectButton from "../_components/RejectButton";
import { openChatFromBookingAction } from "./actions";

import ShippingForm from "./_components/ShippingForm";
import ReturnForm from "./_components/ReturnForm";

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

// ===== Labels =====
const statusLabel: Record<string, string> = {
  PENDING: "Oczekuje na akceptację",
  CONFIRMED: "Potwierdzona",
  AWAITING_PAYMENT: "Oczekuje na płatność",
  PAID: "Opłacona",
  CANCELLED: "Odrzucona",
};

const statusClass: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMED: "bg-sky-100 text-sky-800 border-sky-200",
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
  LOST: "Zgubione lub uszkodzone",
  CANCELLED: "Anulowane",
};

const shippingClass: Record<string, string> = {
  NOT_REQUIRED: "bg-gray-100 text-gray-700 border-gray-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  READY: "bg-sky-100 text-sky-800 border-sky-200",
  SHIPPED: "bg-blue-100 text-blue-800 border-blue-200",
  DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  LOST: "bg-rose-100 text-rose-700 border-rose-200",
  CANCELLED: "bg-gray-100 text-gray-700 border-gray-200",
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
          fianza: true,
          pricePerDay: true,
          userId: true,
        },
      },
      renter: { select: { id: true, name: true } },
    },
  });

  if (!booking) return notFound();

  const isOwner = !!userId && booking.listing?.userId === userId;
  const isRenter = !!userId && booking.renterId === userId;

  const isRejected = booking.status === "CANCELLED";

  const canOwnerEditShipping = isOwner && booking.status === "CONFIRMED";
  const canRenterEditReturn = isRenter && booking.status === "CONFIRMED";
  const returnLocked =
  booking.returnConfirmationStatus === "CONFIRMED" ||
  booking.returnConfirmationStatus === "AUTO_CONFIRMED";

  // ===== Cálculos =====
  const pricePerDay = booking.listing?.pricePerDay ?? 0;
  const deposit = booking.listing?.fianza ?? 0;
  const days = daysInclusive(booking.startDate, booking.endDate);
  const rentTotal = days > 0 ? days * pricePerDay : 0;
  const total = rentTotal + deposit;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    <h1 className="text-2xl font-bold">
      Szczegóły rezerwacji
    </h1>

    <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-700 border">
      #{booking.bookingNumber}
    </span>
  </div>

  <Link href="/bookings" className="text-blue-600 underline">
    ← Wróć
  </Link>
</div>


      {/* ===== Info general ===== */}
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

          <div className="flex flex-col items-end gap-2">
            {badge(
              statusLabel[booking.status] ?? booking.status,
              statusClass[booking.status]
            )}

            {userId && (
              <form action={openChatFromBookingAction}>
                <input type="hidden" name="bookingId" value={id} />
                <button className="px-3 py-1.5 rounded border text-gray-700 hover:bg-gray-50">
                  Otwórz czat
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ===== Mensaje si está rechazada ===== */}
      {isRejected && (
        <section className="p-4 border rounded bg-white text-sm text-gray-600">
          Rezerwacja została odrzucona — szczegóły płatności, dostawy i zwrotu nie
          są dostępne.
        </section>
      )}

      {/* ===== Secciones solo si NO está rechazada ===== */}
      {!isRejected && (
        <>
          {/* ===== Płatność ===== */}
          <section className="border rounded bg-white overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h2 className="text-lg font-semibold">Płatność</h2>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-gray-500">Od</div>
                  <div className="font-semibold">
                    {fmtDate(booking.startDate)}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-gray-500">Do</div>
                  <div className="font-semibold">
                    {fmtDate(booking.endDate)}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border">
                <div className="divide-y">
                  <div className="flex justify-between px-3 py-2 text-sm">
                    <span>Liczba dni</span>
                    <span>{days}</span>
                  </div>
                  <div className="flex justify-between px-3 py-2 text-sm">
                    <span>Cena za dzień</span>
                    <span>{pricePerDay} zł</span>
                  </div>
                  <div className="flex justify-between px-3 py-2 text-sm">
                    <span>Koszt najmu</span>
                    <span>{rentTotal} zł</span>
                  </div>
                  <div className="flex justify-between px-3 py-2 text-sm">
                    <span>Kaucja (zwrotna)</span>
                    <span>{deposit} zł</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-indigo-50 px-3 py-3 flex justify-between">
                <span className="font-semibold">Razem do zapłaty</span>
                <span className="font-bold text-indigo-700">{total} zł</span>
              </div>
            </div>
          </section>

          {/* ===== Dostawa ===== */}
          <section className="p-4 border rounded bg-white space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
  Dostawa
  <span className="text-xs text-gray-400 font-normal">
    (uzupełnia właściciel)
  </span>
</h2>


            {badge(
              shippingLabel[booking.shippingStatus],
              shippingClass[booking.shippingStatus]
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>Przewoźnik: {booking.carrier ?? "—"}</div>
              <div>Numer śledzenia: {booking.trackingNumber ?? "—"}</div>
              <div>Wysłano: {fmt(booking.shippedAt)}</div>
              <div>Dostarczono: {fmt(booking.deliveredAt)}</div>
            </div>

            {canOwnerEditShipping && (
              <ShippingForm
                bookingId={id}
                initial={{
                  shippingStatus: booking.shippingStatus,
                  carrier: booking.carrier,
                  trackingNumber: booking.trackingNumber,
                  shippedAt: booking.shippedAt,
                  deliveredAt: booking.deliveredAt,
                }}
              />
            )}
          </section>

          {/* ===== Zwrot ===== */}
          <section className="p-4 border rounded bg-white space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
  Zwrot
  <span className="text-xs text-gray-400 font-normal">
    (uzupełnia najemca)
  </span>
</h2>


            {badge(
              shippingLabel[booking.returnStatus],
              shippingClass[booking.returnStatus]
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>Przewoźnik: {booking.returnCarrier ?? "—"}</div>
              <div>
                Numer śledzenia: {booking.returnTrackingNumber ?? "—"}
              </div>
              <div>Wysłano: {fmt(booking.returnShippedAt)}</div>
              <div>Odebrano: {fmt(booking.returnDeliveredAt)}</div>
            </div>

            {canRenterEditReturn && (
              <ReturnForm
                bookingId={id}
                locked={returnLocked}
                initial={{
                  returnStatus: booking.returnStatus,
                  returnCarrier: booking.returnCarrier,
                  returnTrackingNumber: booking.returnTrackingNumber,
                }}
              />
            )}
          </section>
        </>
      )}

      {/* ===== Acciones (solo propietario) ===== */}
      {isOwner && booking.status === "PENDING" && (
        <section className="p-4 border rounded bg-white">
          <h2 className="text-lg font-semibold mb-2">Akcje</h2>
          <div className="flex gap-3">
            <ApproveButton bookingId={id} />
            <RejectButton bookingId={id} />
          </div>
        </section>
      )}
    </div>
  );
}
