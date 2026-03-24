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
import DepositActions from "./_components/DepositActions";

import { confirmDeliveryAction } from "./_actions/confirmDeliveryAction";
import { confirmReturnAction } from "./_actions/confirmReturnAction";

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

const moneyCents = (v?: number | null) => `${Math.round((v ?? 0) / 100)} zł`;

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

const deliveryConfirmLabel: Record<string, string> = {
  NOT_REQUESTED: "Nie wymaga potwierdzenia",
  AWAITING_CONFIRMATION: "Oczekuje na potwierdzenie odbioru",
  CONFIRMED: "Odbiór potwierdzony",
  DISPUTED: "Spór",
  AUTO_CONFIRMED: "Automatycznie potwierdzono",
};

const returnConfirmLabel: Record<string, string> = {
  NOT_REQUESTED: "Nie wymaga potwierdzenia",
  AWAITING_CONFIRMATION: "Oczekuje na potwierdzenie zwrotu",
  CONFIRMED: "Zwrot potwierdzony",
  DISPUTED: "Spór",
  AUTO_CONFIRMED: "Automatycznie potwierdzono",
};

const depositLabel: Record<string, string> = {
  NONE: "Brak kaucji",
  PENDING: "Oczekuje",
  PAID: "Opłacona",
  REFUND_PENDING: "Zwrot w toku",
  REFUNDED: "Zwrócona",
  PARTIALLY_REFUNDED: "Częściowo zwrócona",
  RETAINED: "Zatrzymana",
  FAILED: "Błąd",
};

const depositClass: Record<string, string> = {
  NONE: "bg-gray-100 text-gray-700 border-gray-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  PAID: "bg-sky-100 text-sky-800 border-sky-200",
  REFUND_PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  REFUNDED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PARTIALLY_REFUNDED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  RETAINED: "bg-rose-100 text-rose-700 border-rose-200",
  FAILED: "bg-rose-100 text-rose-700 border-rose-200",
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
    select: {
      id: true,
      bookingNumber: true,
      listingId: true,
      renterId: true,
      ownerId: true,

      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,

      paymentStatus: true,
      depositCents: true,
      depositStatus: true,
      depositPaidAt: true,
      depositRefundedAt: true,
      depositRefundedCents: true,
      depositRetainedCents: true,
      depositLastError: true,

      // shipping
      shippingStatus: true,
      carrier: true,
      trackingNumber: true,
      shippedAt: true,
      deliveredAt: true,

      // delivery confirmations
      deliveryConfirmationStatus: true,
      deliveryConfirmedAt: true,
      deliveryConfirmBy: true,

      // return shipping
      returnStatus: true,
      returnCarrier: true,
      returnTrackingNumber: true,
      returnShippedAt: true,
      returnDeliveredAt: true,

      // return confirmations
      returnConfirmationStatus: true,
      returnConfirmedAt: true,
      returnConfirmBy: true,

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

  const logisticsEnabled = booking.status === "PAID";

  const isOwner = !!userId && booking.ownerId === userId;
  const isRenter = !!userId && booking.renterId === userId;

  const isRejected = booking.status === "CANCELLED";

  const canOwnerEditShipping = isOwner && logisticsEnabled;

  const deliveryLocked =
    booking.deliveryConfirmationStatus === "CONFIRMED" ||
    booking.deliveryConfirmationStatus === "AUTO_CONFIRMED";

  const returnLocked =
    booking.returnConfirmationStatus === "CONFIRMED" ||
    booking.returnConfirmationStatus === "AUTO_CONFIRMED";

  const renterCanConfirmDelivery =
    isRenter && booking.deliveryConfirmationStatus === "AWAITING_CONFIRMATION";

  const ownerCanConfirmReturn =
    isOwner && booking.returnConfirmationStatus === "AWAITING_CONFIRMATION";

  const deliveryCompleted =
    booking.shippingStatus === "DELIVERED" &&
    (booking.deliveryConfirmationStatus === "CONFIRMED" ||
      booking.deliveryConfirmationStatus === "AUTO_CONFIRMED");

  const canRenterEditReturn =
    isRenter && logisticsEnabled && deliveryCompleted;

  // ===== Cálculos =====
  const pricePerDay = booking.listing?.pricePerDay ?? 0;
  const deposit = booking.listing?.fianza ?? 0;
  const days = daysInclusive(booking.startDate, booking.endDate);
  const rentTotal = days > 0 ? days * pricePerDay : 0;
  const total = rentTotal + deposit;

  const returnCompleted =
    booking.returnConfirmationStatus === "CONFIRMED" ||
    booking.returnConfirmationStatus === "AUTO_CONFIRMED";

  const canOwnerManageDeposit =
    isOwner &&
    booking.status === "PAID" &&
    returnCompleted &&
    !!booking.depositCents &&
    booking.depositCents > 0 &&
    booking.depositStatus === "PAID";

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Szczegóły rezerwacji</h1>
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
              statusClass[booking.status] ??
                "bg-gray-100 text-gray-800 border-gray-200"
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

      {isRejected && (
        <section className="p-4 border rounded bg-white text-sm text-gray-600">
          Rezerwacja została odrzucona — szczegóły płatności, dostawy i zwrotu
          nie są dostępne.
        </section>
      )}

      {!isRejected && (
        <>
          {/* ===== Płatność ===== */}
          <section className="border rounded bg-white overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Płatność</h2>

              <div className="flex items-center gap-2">
                {badge(
                  booking.status === "PAID"
                    ? "Opłacona"
                    : booking.status === "AWAITING_PAYMENT" ||
                      booking.status === "CONFIRMED"
                    ? "Oczekuje na płatność"
                    : booking.status === "PENDING"
                    ? "Oczekuje na akceptację"
                    : booking.status,
                  booking.status === "PAID"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : booking.status === "AWAITING_PAYMENT" ||
                      booking.status === "CONFIRMED"
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "bg-gray-100 text-gray-800 border-gray-200"
                )}

                {isRenter &&
                  (booking.status === "AWAITING_PAYMENT" ||
                    booking.status === "CONFIRMED") && (
                    <Link
                      href={`/bookings/${booking.id}/pay`}
                      className="px-3 py-1.5 rounded border bg-white text-gray-800 hover:bg-gray-50"
                    >
                      Opłać
                    </Link>
                  )}
              </div>
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
                  <div className="font-semibold">{fmtDate(booking.endDate)}</div>
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

          {/* ✅ LOGISTYKA solo tras pago */}
          {!logisticsEnabled ? (
            <section className="p-4 border rounded bg-white text-sm text-gray-600">
              Logistyka (dostawa i zwrot) będzie dostępna dopiero po opłaceniu
              rezerwacji.
            </section>
          ) : (
            <>
              {/* ===== Dostawa ===== */}
              <section className="p-4 border rounded bg-white space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Dostawa
                  <span className="text-xs text-gray-400 font-normal">
                    (uzupełnia właściciel)
                  </span>
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  {booking.deliveryConfirmationStatus !== "NOT_REQUESTED"
                    ? badge(
                        deliveryConfirmLabel[
                          booking.deliveryConfirmationStatus
                        ] ?? booking.deliveryConfirmationStatus,
                        booking.deliveryConfirmationStatus ===
                          "AWAITING_CONFIRMATION"
                          ? "bg-amber-50 text-amber-900 border-amber-200"
                          : booking.deliveryConfirmationStatus ===
                              "CONFIRMED" ||
                            booking.deliveryConfirmationStatus ===
                              "AUTO_CONFIRMED"
                          ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                          : "bg-gray-50 text-gray-700 border-gray-200"
                      )
                    : badge(
                        shippingLabel[booking.shippingStatus] ??
                          booking.shippingStatus,
                        shippingClass[booking.shippingStatus] ??
                          "bg-gray-100 text-gray-800 border-gray-200"
                      )}
                </div>

                {booking.deliveryConfirmationStatus !== "NOT_REQUESTED" && (
                  <div className="text-xs text-gray-500">
                    Status przewozu:{" "}
                    <span className="font-medium text-gray-700">
                      {shippingLabel[booking.shippingStatus] ??
                        booking.shippingStatus}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>Przewoźnik: {booking.carrier ?? "—"}</div>
                  <div>Numer śledzenia: {booking.trackingNumber ?? "—"}</div>
                  <div>Wysłano: {fmt(booking.shippedAt)}</div>
                  <div>Dostarczono: {fmt(booking.deliveredAt)}</div>
                  <div>Potwierdzone: {fmt(booking.deliveryConfirmedAt)}</div>
                  <div>Potwierdź do: {fmt(booking.deliveryConfirmBy)}</div>
                </div>

                {renterCanConfirmDelivery && (
                  <form action={confirmDeliveryAction}>
                    <input type="hidden" name="bookingId" value={id} />
                    <button className="w-full sm:w-auto bg-emerald-600 text-white rounded px-4 py-2">
                      Potwierdzam odbiór
                    </button>
                  </form>
                )}

                {canOwnerEditShipping && !deliveryLocked && (
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

                {deliveryLocked && (
                  <p className="text-xs text-gray-500">
                    Odbiór został potwierdzony — edycja dostawy zablokowana.
                  </p>
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

                <div className="flex flex-wrap items-center gap-2">
                  {booking.returnConfirmationStatus !== "NOT_REQUESTED"
                    ? badge(
                        returnConfirmLabel[
                          booking.returnConfirmationStatus
                        ] ?? booking.returnConfirmationStatus,
                        booking.returnConfirmationStatus ===
                          "AWAITING_CONFIRMATION"
                          ? "bg-amber-50 text-amber-900 border-amber-200"
                          : booking.returnConfirmationStatus === "CONFIRMED" ||
                            booking.returnConfirmationStatus ===
                              "AUTO_CONFIRMED"
                          ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                          : "bg-gray-50 text-gray-700 border-gray-200"
                      )
                    : badge(
                        shippingLabel[booking.returnStatus] ??
                          booking.returnStatus,
                        shippingClass[booking.returnStatus] ??
                          "bg-gray-100 text-gray-800 border-gray-200"
                      )}
                </div>

                {booking.returnConfirmationStatus !== "NOT_REQUESTED" && (
                  <div className="text-xs text-gray-500">
                    Status zwrotu:{" "}
                    <span className="font-medium text-gray-700">
                      {shippingLabel[booking.returnStatus] ??
                        booking.returnStatus}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>Przewoźnik: {booking.returnCarrier ?? "—"}</div>
                  <div>
                    Numer śledzenia: {booking.returnTrackingNumber ?? "—"}
                  </div>
                  <div>Wysłano: {fmt(booking.returnShippedAt)}</div>
                  <div>Odebrano: {fmt(booking.returnDeliveredAt)}</div>
                  <div>Potwierdzone: {fmt(booking.returnConfirmedAt)}</div>
                  <div>Potwierdź do: {fmt(booking.returnConfirmBy)}</div>
                </div>

                {ownerCanConfirmReturn && (
                  <form action={confirmReturnAction}>
                    <input type="hidden" name="bookingId" value={id} />
                    <button className="w-full sm:w-auto bg-emerald-600 text-white rounded px-4 py-2">
                      Potwierdzam zwrot
                    </button>
                  </form>
                )}

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

                {!canRenterEditReturn && !returnLocked && (
                  <p className="text-xs text-gray-500">
                    Formularz zwrotu będzie dostępny dopiero po potwierdzeniu
                    dostawy.
                  </p>
                )}

                {returnLocked && (
                  <p className="text-xs text-gray-500">
                    Zwrot został potwierdzony — edycja zablokowana.
                  </p>
                )}
              </section>

              {/* ===== Kaucja ===== */}
              <section className="p-4 border rounded bg-white space-y-3">
                <h2 className="text-lg font-semibold">Kaucja</h2>

                <div className="flex flex-wrap items-center gap-2">
                  {badge(
                    depositLabel[booking.depositStatus] ?? booking.depositStatus,
                    depositClass[booking.depositStatus] ??
                      "bg-gray-100 text-gray-800 border-gray-200"
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>Kaucja pobrana: {moneyCents(booking.depositCents)}</div>
                  <div>Zwrócono: {moneyCents(booking.depositRefundedCents)}</div>
                  <div>Zatrzymano: {moneyCents(booking.depositRetainedCents)}</div>
                  <div>Data zwrotu: {fmt(booking.depositRefundedAt)}</div>
                </div>

                {booking.depositLastError && (
                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">
                    Ostatni błąd: {booking.depositLastError}
                  </div>
                )}

                {!booking.depositCents || booking.depositCents <= 0 ? (
                  <p className="text-xs text-gray-500">
                    Ta rezerwacja nie zawiera kaucji.
                  </p>
                ) : !returnCompleted ? (
                  <p className="text-xs text-gray-500">
                    Zarządzanie kaucją będzie dostępne po potwierdzeniu zwrotu.
                  </p>
                ) : canOwnerManageDeposit ? (
                  <DepositActions bookingId={booking.id} />
                ) : (
                  <p className="text-xs text-gray-500">
                    Kaucja została już rozliczona lub jest w trakcie rozliczania.
                  </p>
                )}
              </section>
            </>
          )}
        </>
      )}

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