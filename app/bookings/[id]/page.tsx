import { isPaymentDeadlineExpired } from "@/app/lib/paymentDeadline";
import { Suspense } from "react";
import InpostTracking from "./_components/InpostTracking";
import { isInpost, normalizeInpostNumber } from "@/app/lib/inpostTracking";
import { prisma } from "@/app/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/app/lib/auth";
import { canUploadBookingEvidence } from "@/app/lib/bookingEvidence";
import { canViewBookingEvidencePhoto } from "@/app/lib/bookingEvidenceVisibility";
import { ApproveButton } from "../_components/ApproveButton";
import RejectButton from "../_components/RejectButton";
import { openChatFromBookingAction } from "./actions";

import ShippingForm from "./_components/ShippingForm";
import BookingProgress from "./_components/BookingProgress";
import BookingEvidencePhotos from "./_components/BookingEvidencePhotos";
import InpostDestination from "./_components/InpostDestination";
import ReturnForm from "./_components/ReturnForm";
import FinalSettlementSummary from "./_components/FinalSettlementSummary";
import DepositActions from "./_components/DepositActions";
import DepositClaimPanel from "./_components/DepositClaimPanel";
import { canClaimNotReturned, readDepositClaim } from "@/app/lib/depositClaim";
import { readIssue, hasReturnReceipt } from "@/app/lib/logisticsIssue";

import LogisticsIssuePanel from "./_components/LogisticsIssuePanel";
import ReceiptActions from "./_components/ReceiptActions";
import { canReceive } from "@/app/lib/logistics";
import { getApprovalDeadline } from "@/app/lib/approvalExpiry";

/* ============================================================
   HELPERS
============================================================ */

const fmt = (d?: Date | null) =>
  d
    ? d.toLocaleString("pl-PL", {
        timeZone: "Europe/Warsaw",
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
  <span className={`text-xs px-2 py-1 rounded border ${cls}`}>
    {label}
  </span>
);

const moneyCents = (value?: number | null) =>
  `${new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 2,
  }).format((value ?? 0) / 100)} zł`;

function daysInclusive(a: Date, b: Date) {
  const start = new Date(a);
  start.setHours(0, 0, 0, 0);

  const end = new Date(b);
  end.setHours(0, 0, 0, 0);

  return (
    Math.floor(
      (end.getTime() - start.getTime()) / 86_400_000
    ) + 1
  );
}

/* ============================================================
   LABELS
============================================================ */

const statusLabel: Record<string, string> = {
  PENDING: "Oczekuje na akceptację",
  CONFIRMED: "Potwierdzona",
  AWAITING_PAYMENT: "Oczekuje na płatność",
  PAID: "Opłacona",
  CANCELLED: "Anulowana",
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
  DISPUTED: "Zgłoszono problem",
  AUTO_CONFIRMED: "Automatycznie potwierdzono",
};

const returnConfirmLabel: Record<string, string> = {
  NOT_REQUESTED: "Nie wymaga potwierdzenia",
  AWAITING_CONFIRMATION: "Oczekuje na potwierdzenie zwrotu",
  CONFIRMED: "Zwrot potwierdzony",
  DISPUTED: "Zgłoszono problem",
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

function confirmationClass(status: string) {
  if (status === "AWAITING_CONFIRMATION") {
    return "bg-amber-50 text-amber-900 border-amber-200";
  }

  if (
    status === "CONFIRMED" ||
    status === "AUTO_CONFIRMED"
  ) {
    return "bg-emerald-50 text-emerald-900 border-emerald-200";
  }

  return "bg-gray-50 text-gray-700 border-gray-200";
}

/* ============================================================
   PAGE
============================================================ */

export default async function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  const userId = session?.user?.id ?? null;
  if (!userId) redirect(`/login?callbackUrl=${encodeURIComponent(`/bookings/${id}`)}`);

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
      paymentDueAt: true,

      // Snapshot económico
      pricePerDayCents: true,
      rentAmountCents: true,
      platformFeeRate: true,
      platformFeeCents: true,
      ownerPayoutCents: true,
      depositCents: true,

      // Fianza
      depositStatus: true,
      depositClaim: true,
      settlementDecision: true,
      settlementCompletedAt: true,
      ownerTransferId: true,
      ownerTransferCents: true,
      depositTransferId: true,
      depositTransferredCents: true,
      depositRefundId: true,
      depositPaidAt: true,
      depositRefundedAt: true,
      depositRefundedCents: true,
      depositRetainedCents: true,
      depositLastError: true,

      // Entrega
      shippingStatus: true,
      carrier: true,
      trackingNumber: true,
      shippedAt: true,
      deliveredAt: true,
      deliveryInpostPointCode: true,
      deliveryInpostPointAddress: true,

      deliveryConfirmationStatus: true,
      deliveryConfirmedAt: true,
      deliveryConfirmBy: true,
      deliveryIssue: true,

      // Devolución
      returnStatus: true,
      returnCarrier: true,
      returnTrackingNumber: true,
      returnShippedAt: true,
      returnDeliveredAt: true,
      returnInpostPointCode: true,
      returnInpostPointAddress: true,

      returnConfirmationStatus: true,
      returnConfirmedAt: true,
      returnConfirmBy: true,
      returnIssue: true,

      listing: {
        select: {
          id: true,
          title: true,
          fianza: true,
          pricePerDay: true,
          userId: true,
        },
      },

      renter: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          phoneVerifiedAt: true,
          preferredInpostPointCode: true,
          preferredInpostPointAddress: true,
        },
      },
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          phoneVerifiedAt: true,
          preferredInpostPointCode: true,
          preferredInpostPointAddress: true,
        },
      },
    },
  });

  if (!booking) {
    return notFound();
  }

  const isOwner =
    !!userId && booking.ownerId === userId;

  const isRenter =
    !!userId && booking.renterId === userId;
  if (!isOwner && !isRenter) return notFound();
  const evidencePhotos = booking.paymentStatus === "PAID"
    ? await prisma.bookingEvidencePhoto.findMany({
        where: { bookingId: id },
        select: { id: true, stage: true, uploaderId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const visibleEvidencePhotos = evidencePhotos.filter(photo => canViewBookingEvidencePhoto(booking, photo, userId));
  const contactVisible = booking.paymentStatus === "PAID" && (isOwner || isRenter);
  const counterpart = isOwner ? booking.renter : booking.owner;

  const deliveryTracking = isInpost(booking.carrier) ? normalizeInpostNumber(booking.trackingNumber) : null;
  const returnTracking = isInpost(booking.returnCarrier) ? normalizeInpostNumber(booking.returnTrackingNumber) : null;
  const isCancelled =
    booking.status === "CANCELLED";
  const awaitingApproval = booking.status === "PENDING";

  const approvalDeadline = getApprovalDeadline(
    booking.createdAt
  );

  const approvalExpired =
    awaitingApproval && approvalDeadline <= new Date();

  const approvalDeadlineFormatted =
    new Intl.DateTimeFormat("pl-PL", {
      timeZone: "Europe/Warsaw",
      dateStyle: "short",
      timeStyle: "short",
    }).format(approvalDeadline);
  /* ==========================================================
     PLAZO DE PAGO
  ========================================================== */

  const awaitingPayment =
    booking.status === "AWAITING_PAYMENT" &&
    booking.paymentStatus === "PENDING";

  const paymentExpired = isPaymentDeadlineExpired(booking);

  const canPay =
    isRenter &&
    awaitingPayment &&
    booking.paymentDueAt !== null &&
    !paymentExpired;

  const paymentDeadline = booking.paymentDueAt
    ? new Intl.DateTimeFormat("pl-PL", {
        timeZone: "Europe/Warsaw",
        dateStyle: "short",
        timeStyle: "short",
      }).format(booking.paymentDueAt)
    : null;

  /* ==========================================================
     LOGÍSTICA
  ========================================================== */

  const logisticsEnabled =
    booking.paymentStatus === "PAID";

  const canOwnerEditShipping =
    isOwner && logisticsEnabled && booking.shippingStatus !== "DELIVERED" &&
    booking.deliveryConfirmationStatus !== "DISPUTED";

  const deliveryLocked =
    booking.deliveryConfirmationStatus === "CONFIRMED" ||
    booking.deliveryConfirmationStatus === "AUTO_CONFIRMED";

  const returnLocked =
    booking.returnConfirmationStatus === "CONFIRMED" ||
    booking.returnConfirmationStatus === "AUTO_CONFIRMED";

  const renterCanConfirmDelivery = isRenter && canReceive(booking, "DELIVERY");
  const ownerCanConfirmReturn = isOwner && canReceive(booking, "RETURN");

  const deliveryCompleted =
    booking.shippingStatus === "DELIVERED" &&
    deliveryLocked;

  const canRenterEditReturn =
    isRenter &&
    logisticsEnabled &&
    deliveryCompleted && !returnLocked &&
    !["SHIPPED", "DELIVERED"].includes(booking.returnStatus) &&
    booking.returnConfirmationStatus !== "DISPUTED";

  /* ==========================================================
     IMPORTES
  ========================================================== */

  const days = daysInclusive(
    booking.startDate,
    booking.endDate
  );

  const pricePerDayCents =
    booking.pricePerDayCents ??
    (booking.listing?.pricePerDay ?? 0) * 100;

  const rentAmountCents =
    booking.rentAmountCents ??
    (days > 0 ? days * pricePerDayCents : 0);

  const depositCents =
    booking.depositCents ??
    (booking.listing?.fianza ?? 0) * 100;

  const platformFeeRate =
    booking.platformFeeRate ?? 1500;

  const platformFeeCents =
    booking.platformFeeCents ??
    Math.round(
      (rentAmountCents * platformFeeRate) / 10_000
    );

  const ownerPayoutCents =
    booking.ownerPayoutCents ??
    rentAmountCents - platformFeeCents;

  const platformFeePercent = platformFeeRate / 100;

  /* ==========================================================
     FIANZA
  ========================================================== */

  const returnCompleted = returnLocked;

  const settlementPending =
    !!booking.settlementDecision &&
    !booking.settlementCompletedAt;

  const canOwnerManageDeposit =
    isOwner &&
    booking.paymentStatus === "PAID" &&
    returnCompleted &&
    !!booking.depositCents &&
    booking.depositCents > 0 &&
    (
      booking.depositStatus === "PAID" ||
      settlementPending
    );

  const paymentLabel =
    booking.paymentStatus === "PAID"
      ? "Opłacona"
      : paymentExpired
        ? "Termin płatności upłynął"
        : booking.status === "AWAITING_PAYMENT"
          ? "Oczekuje na płatność"
          : booking.status === "PENDING"
            ? "Oczekuje na akceptację"
            : "—";

  const paymentClass =
    booking.paymentStatus === "PAID"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : paymentExpired
        ? "bg-rose-100 text-rose-700 border-rose-200"
        : booking.status === "AWAITING_PAYMENT"
          ? "bg-amber-100 text-amber-800 border-amber-200"
          : "bg-gray-100 text-gray-800 border-gray-200";

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* HEADER */}

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">
            Szczegóły rezerwacji
          </h1>

          <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-700 border">
            #{booking.bookingNumber}
          </span>
        </div>

        <Link
          href="/bookings"
          className="text-blue-600 underline"
        >
          ← Wróć
        </Link>
      </div>

      {/* INFORMACIÓN GENERAL */}

      <section className="p-4 border rounded bg-white space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-gray-500">
              Ogłoszenie
            </div>

            <Link
              href={`/listing/${booking.listingId}`}
              className="text-blue-700 hover:underline font-medium break-words"
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
              paymentExpired ? "Termin płatności upłynął" : statusLabel[booking.status] ?? booking.status,
              paymentExpired ? "bg-rose-100 text-rose-700 border-rose-200" : statusClass[booking.status] ??
                "bg-gray-100 text-gray-800 border-gray-200"
            )}

            {userId && (
              <form action={openChatFromBookingAction}>
                <input
                  type="hidden"
                  name="bookingId"
                  value={id}
                />

                <button className="px-3 py-1.5 rounded border text-gray-700 hover:bg-gray-50">
                  Otwórz czat
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {!isCancelled && <BookingProgress booking={booking} />}

      {contactVisible && (
        <section className="p-4 border rounded bg-white space-y-2">
          <h2 className="text-lg font-semibold">Kontakt do {isOwner ? "najemcy" : "właściciela"}</h2>
          <p className="text-sm text-gray-600">Dane są udostępnione wyłącznie stronom opłaconej rezerwacji. Do ustaleń i zachowania historii rozmowy używaj przede wszystkim czatu MojaSzafa.</p>
          <p><strong>{counterpart.name ?? "Użytkownik"}:</strong>{" "}
            {counterpart.phone && counterpart.phoneVerifiedAt
              ? <a className="text-blue-700 underline" href={`tel:${counterpart.phone}`}>{counterpart.phone}</a>
              : "brak zweryfikowanego numeru"}
          </p>
        </section>
      )}

      {awaitingApproval && (
        <section
          className={
            approvalExpired
              ? "p-4 border border-rose-200 rounded bg-rose-50 text-sm text-rose-900"
              : "p-4 border border-amber-200 rounded bg-amber-50 text-sm text-amber-900"
          }
        >
          <p>
            <strong>Termin akceptacji:</strong>{" "}
            {approvalDeadlineFormatted} (czas polski).
          </p>

          <p className="mt-1">
            {approvalExpired
              ? isOwner
                ? "Termin akceptacji upłynął. Nie możesz już zaakceptować tej prośby. Rezerwacja oczekuje na anulowanie."
                : "Właściciel nie zaakceptował prośby w terminie. Rezerwacja oczekuje na anulowanie."
              : isOwner
                ? "Masz 12 godzin od utworzenia prośby na jej akceptację. Jeśli nie zaakceptujesz jej w terminie, rezerwacja zostanie anulowana."
                : "Właściciel ma 12 godzin od utworzenia prośby na jej akceptację. Jeśli nie zaakceptuje jej w terminie, rezerwacja zostanie anulowana."}
          </p>
        </section>
      )}

      {/* RESERVA CANCELADA */}

      {isCancelled && (
        <section className="p-4 border rounded bg-white text-sm text-gray-600">
          Rezerwacja została anulowana — szczegóły płatności,
          dostawy i zwrotu nie są dostępne.
        </section>
      )}

      {!isCancelled && (
        <>
          {/* PAGO */}

          <section className="border rounded bg-white overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                Płatność
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                {badge(paymentLabel, paymentClass)}

                {canPay && (
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
              {awaitingPayment && paymentDeadline && (
                <div
                  className={
                    paymentExpired
                      ? "rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
                      : "rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                  }
                >
                  <p>
                    <strong>Termin płatności:</strong>{" "}
                    {paymentDeadline} (czas polski).
                  </p>

                           {paymentExpired ? (
                    <p className="mt-1">
                      {isOwner
                        ? "Termin płatności najemcy upłynął. Po sprawdzeniu statusu płatności rezerwacja zostanie anulowana, jeśli nie została opłacona."
                        : "Twój termin płatności upłynął. Nie możesz rozpocząć nowej płatności. Po sprawdzeniu statusu płatności rezerwacja zostanie anulowana, jeśli nie została opłacona."}
                    </p>
                  ) : (
                    <p className="mt-1">
                      {isOwner
                        ? "Najemca ma 12 godzin od Twojej akceptacji na opłacenie rezerwacji. Jeśli nie zapłaci w terminie, rezerwacja zostanie anulowana."
                        : "Masz 12 godzin od akceptacji właściciela na opłacenie rezerwacji. Jeśli nie zapłacisz w terminie, rezerwacja zostanie anulowana."}
                    </p>
                  )}
                </div>
              )}

              {awaitingPayment && !paymentDeadline && (
                <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Brak terminu płatności. Skontaktuj się z obsługą
                  serwisu, aby wyjaśnić status rezerwacji.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-gray-500">
                    Od
                  </div>

                  <div className="font-semibold">
                    {fmtDate(booking.startDate)}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs text-gray-500">
                    Do
                  </div>

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
                    <span>{moneyCents(pricePerDayCents)}</span>
                  </div>

                  <div className="flex justify-between px-3 py-2 text-sm">
                    <span>Koszt najmu</span>
                    <span>{moneyCents(rentAmountCents)}</span>
                  </div>

                  {isOwner && (
                    <div className="flex justify-between px-3 py-2 text-sm">
                      <span>
                        Prowizja MojaSzafa ({platformFeePercent}%)
                      </span>

                      <span className="text-gray-600">
                        −{moneyCents(platformFeeCents)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between px-3 py-2 text-sm">
                    <span>Kaucja (zwrotna)</span>
                    <span>{moneyCents(depositCents)}</span>
                  </div>
                </div>
              </div>

              {isOwner && (
                <div className="rounded-lg border bg-emerald-50 px-3 py-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">
                      Twoje wynagrodzenie
                    </span>

                    <span className="font-bold text-emerald-700">
                      {moneyCents(ownerPayoutCents)}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mt-1">
                    Kwota za najem po odliczeniu prowizji MojaSzafa.
                    Kaucja nie jest objęta prowizją.
                  </p>
                </div>
              )}

              {isRenter && (
                <div className="rounded-lg border bg-indigo-50 px-3 py-3 flex justify-between">
                  <span className="font-semibold">
                    Razem do zapłaty w MojaSzafa
                  </span>

                  <span className="font-bold text-indigo-700">
                    {moneyCents(rentAmountCents + depositCents)}
                  </span>
                </div>
              )}
              <p className="text-xs text-gray-600">Przy wysyłce InPost koszt etykiety nie jest wliczony w płatność za rezerwację. Osoba nadająca przesyłkę opłaca ją bezpośrednio w InPost.</p>
            </div>
          </section>

          {/* LOGÍSTICA */}

          {!logisticsEnabled ? (
            <section className="p-4 border rounded bg-white text-sm text-gray-600">
              Logistyka (dostawa i zwrot) będzie dostępna dopiero
              po opłaceniu rezerwacji.
            </section>
          ) : (
            <>
              {/* ENTREGA */}

              <section className="p-4 border rounded bg-white space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Dostawa

                  <span className="text-xs text-gray-400 font-normal">
                    (uzupełnia właściciel)
                  </span>
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  {booking.deliveryConfirmationStatus !==
                  "NOT_REQUESTED"
                    ? badge(
                        deliveryConfirmLabel[
                          booking.deliveryConfirmationStatus
                        ] ?? booking.deliveryConfirmationStatus,
                        confirmationClass(
                          booking.deliveryConfirmationStatus
                        )
                      )
                    : badge(
                        shippingLabel[booking.shippingStatus] ??
                          booking.shippingStatus,
                        shippingClass[booking.shippingStatus] ??
                          "bg-gray-100 text-gray-800 border-gray-200"
                      )}
                </div>

                {booking.deliveryConfirmationStatus !==
                  "NOT_REQUESTED" && (
                  <div className="text-xs text-gray-500">
                    Status przewozu:{" "}
                    <span className="font-medium text-gray-700">
                      {shippingLabel[booking.shippingStatus] ??
                        booking.shippingStatus}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    Przewoźnik: {booking.carrier ?? "—"}
                  </div>

                  <div>
                    Numer śledzenia:{" "}
                    {booking.trackingNumber ?? "—"}
                  </div>

                  <div>
                    Wysłano: {fmt(booking.shippedAt)}
                  </div>

                  <div>
                    Dostarczono: {fmt(booking.deliveredAt)}
                  </div>

                  <div>
                    Potwierdzone:{" "}
                    {fmt(booking.deliveryConfirmedAt)}
                  </div>


                </div>

                {(isOwner || isRenter) && booking.carrier !== "Odbiór osobisty" && <InpostDestination
                  bookingId={id}
                  stage="DELIVERY"
                  isRecipient={isRenter}
                  locked={!["PENDING", "READY"].includes(booking.shippingStatus)}
                  code={booking.deliveryInpostPointCode}
                  address={booking.deliveryInpostPointAddress}
                  preferredCode={isRenter ? booking.renter.preferredInpostPointCode : null}
                  preferredAddress={isRenter ? booking.renter.preferredInpostPointAddress : null}
                  geowidgetToken={process.env.INPOST_GEOWIDGET_TOKEN?.trim() || null}
                  recipient={{ name: booking.renter.name, email: booking.renter.email, phone: booking.renter.phoneVerifiedAt ? booking.renter.phone : null }}
                />}

                {userId && <BookingEvidencePhotos
                  bookingId={id}
                  stage="DELIVERY"
                  userId={userId}
                  ownerId={booking.ownerId}
                  renterId={booking.renterId}
                  canUpload={canUploadBookingEvidence(booking, "DELIVERY", userId)}
                  photos={visibleEvidencePhotos.filter(photo => photo.stage === "DELIVERY").map(photo => ({ ...photo, createdAt: photo.createdAt.toISOString() }))}
                />}
                {(isOwner || isRenter) && userId && (
                  <LogisticsIssuePanel
                    bookingId={id}
                    stage="DELIVERY"
                    stored={booking.deliveryIssue}
                    disputed={booking.deliveryConfirmationStatus === "DISPUTED"}
                    recipientId={booking.renterId}
                    userId={userId}
                    canResolve={canReceive({ ...booking, deliveryConfirmationStatus: "AWAITING_CONFIRMATION" }, "DELIVERY")}
                  />
                )}

                {(isOwner || isRenter) && isInpost(booking.carrier) && booking.trackingNumber && (
                  deliveryTracking ? <Suspense key={deliveryTracking} fallback={<p className="text-sm text-gray-500">Pobieranie statusu InPost…</p>}>
                    <InpostTracking number={deliveryTracking} />
                  </Suspense> : <p className="text-sm text-amber-800">Numer przesyłki InPost powinien zawierać 24 cyfry. Sprawdź zapisany numer.</p>
                )}

                {renterCanConfirmDelivery && (
                  <ReceiptActions bookingId={id} stage="DELIVERY" remainingPhotos={Math.max(0, 3 - evidencePhotos.filter(photo => photo.stage === "DELIVERY" && photo.uploaderId === userId).length)} />
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
                    Odbiór został potwierdzony — edycja dostawy
                    zablokowana.
                  </p>
                )}
              </section>

              {/* DEVOLUCIÓN */}

              <section className="p-4 border rounded bg-white space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Zwrot

                  <span className="text-xs text-gray-400 font-normal">
                    (uzupełnia najemca)
                  </span>
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  {booking.returnConfirmationStatus !==
                  "NOT_REQUESTED"
                    ? badge(
                        returnConfirmLabel[
                          booking.returnConfirmationStatus
                        ] ?? booking.returnConfirmationStatus,
                        confirmationClass(
                          booking.returnConfirmationStatus
                        )
                      )
                    : badge(
                        shippingLabel[booking.returnStatus] ??
                          booking.returnStatus,
                        shippingClass[booking.returnStatus] ??
                          "bg-gray-100 text-gray-800 border-gray-200"
                      )}
                </div>

                {booking.returnConfirmationStatus !==
                  "NOT_REQUESTED" && (
                  <div className="text-xs text-gray-500">
                    Status zwrotu:{" "}
                    <span className="font-medium text-gray-700">
                      {shippingLabel[booking.returnStatus] ??
                        booking.returnStatus}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    Przewoźnik:{" "}
                    {booking.returnCarrier ?? "—"}
                  </div>

                  <div>
                    Numer śledzenia:{" "}
                    {booking.returnTrackingNumber ?? "—"}
                  </div>

                  <div>
                    Wysłano: {fmt(booking.returnShippedAt)}
                  </div>

                  <div>
                    Odebrano: {fmt(booking.returnDeliveredAt)}
                  </div>

                  <div>
                    Potwierdzone:{" "}
                    {fmt(booking.returnConfirmedAt)}
                  </div>


                </div>

                {(isOwner || isRenter) && booking.returnCarrier !== "Odbiór osobisty" && <InpostDestination
                  bookingId={id}
                  stage="RETURN"
                  isRecipient={isOwner}
                  locked={!["PENDING", "READY"].includes(booking.returnStatus)}
                  code={booking.returnInpostPointCode}
                  address={booking.returnInpostPointAddress}
                  preferredCode={isOwner ? booking.owner.preferredInpostPointCode : null}
                  preferredAddress={isOwner ? booking.owner.preferredInpostPointAddress : null}
                  geowidgetToken={process.env.INPOST_GEOWIDGET_TOKEN?.trim() || null}
                  recipient={{ name: booking.owner.name, email: booking.owner.email, phone: booking.owner.phoneVerifiedAt ? booking.owner.phone : null }}
                />}

                {userId && <BookingEvidencePhotos
                  bookingId={id}
                  stage="RETURN"
                  userId={userId}
                  ownerId={booking.ownerId}
                  renterId={booking.renterId}
                  canUpload={canUploadBookingEvidence(booking, "RETURN", userId)}
                  photos={visibleEvidencePhotos.filter(photo => photo.stage === "RETURN").map(photo => ({ ...photo, createdAt: photo.createdAt.toISOString() }))}
                />}
                {(isOwner || isRenter) && userId && (
                  <LogisticsIssuePanel
                    bookingId={id}
                    stage="RETURN"
                    receiptConfirmed={booking.returnConfirmedAt !== null}
                    hasDepositClaim={readDepositClaim(booking.depositClaim) !== null}
                    claimNotReturned={readDepositClaim(booking.depositClaim)?.reasonCode === "NOT_RETURNED"}
                    stored={booking.returnIssue}
                    disputed={booking.returnConfirmationStatus === "DISPUTED"}
                    recipientId={booking.ownerId}
                    userId={userId}
                    canResolve={booking.depositClaim === null && canReceive({ ...booking, returnConfirmationStatus: "AWAITING_CONFIRMATION" }, "RETURN")}
                  />
                )}

                {(isOwner || isRenter) && isInpost(booking.returnCarrier) && booking.returnTrackingNumber && (
                  returnTracking ? <Suspense key={returnTracking} fallback={<p className="text-sm text-gray-500">Pobieranie statusu InPost…</p>}>
                    <InpostTracking number={returnTracking} />
                  </Suspense> : <p className="text-sm text-amber-800">Numer przesyłki InPost powinien zawierać 24 cyfry. Sprawdź zapisany numer.</p>
                )}

                {ownerCanConfirmReturn && (
                  <ReceiptActions bookingId={id} stage="RETURN" remainingPhotos={Math.max(0, 3 - evidencePhotos.filter(photo => photo.stage === "RETURN" && photo.uploaderId === userId).length)} />
                )}

                {canRenterEditReturn && (
                  <ReturnForm
                    bookingId={id}
                    locked={returnLocked}
                    initial={{
                      returnStatus: booking.returnStatus,
                      returnCarrier: booking.returnCarrier,
                      returnTrackingNumber:
                        booking.returnTrackingNumber,
                    }}
                  />
                )}

                {isRenter && booking.returnStatus === "SHIPPED" && !returnLocked && (
                  <p className="text-sm text-amber-800">
                    Zwrot został wysłany. Oczekuje na potwierdzenie odbioru przez właściciela — dane zwrotu są teraz zablokowane.
                  </p>
                )}

                {!deliveryCompleted && !returnLocked && (
                  <p className="text-xs text-gray-500">
                    Formularz zwrotu będzie dostępny dopiero po
                    potwierdzeniu dostawy.
                  </p>
                )}

                {returnLocked && (
                  <p className="text-xs text-gray-500">
                    Zwrot został potwierdzony — edycja zablokowana.
                  </p>
                )}
              </section>

              {/* FIANZA */}

              <section className="p-4 border rounded bg-white space-y-3">
                <h2 className="text-lg font-semibold">
                  Kaucja
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  {badge(
                    depositLabel[booking.depositStatus] ??
                      booking.depositStatus,
                    depositClass[booking.depositStatus] ??
                      "bg-gray-100 text-gray-800 border-gray-200"
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    Kaucja pobrana:{" "}
                    {moneyCents(booking.depositCents)}
                  </div>

                  <div>
                    Zwrócono:{" "}
                    {moneyCents(booking.depositRefundedCents)}
                  </div>

                  <div>
                    Zatrzymano:{" "}
                    {moneyCents(booking.depositRetainedCents)}
                  </div>

                  <div>
                    Data zwrotu:{" "}
                    {fmt(booking.depositRefundedAt)}
                  </div>
                </div>

                {booking.depositLastError && (
                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">
                    Ostatni błąd: {booking.depositLastError}
                  </div>
                )}

                {(isOwner || isRenter) && (
                  <DepositClaimPanel
                    bookingId={id}
                    depositCents={booking.depositCents ?? 0}
                    claim={readDepositClaim(booking.depositClaim)}
                    hasClaim={booking.depositClaim !== null}
                    isOwner={isOwner}
                    isRenter={isRenter}
                    returnCompleted={returnCompleted}
                    receiptKnown={hasReturnReceipt(booking)}
                    canPropose={isOwner && booking.paymentStatus === "PAID" && booking.depositStatus === "PAID" && !booking.settlementDecision && !booking.settlementCompletedAt && deliveryCompleted && ["SHIPPED", "DELIVERED"].includes(booking.returnStatus)}
                    canProposeNotReturned={isOwner && booking.paymentStatus === "PAID" && booking.depositStatus === "PAID" && !booking.settlementDecision && !booking.settlementCompletedAt && canClaimNotReturned(booking)}
                    initialReason={readIssue(booking.returnIssue)?.description ?? ""}
                    initialReasonCode={readIssue(booking.returnIssue)?.reason === "MISSING_ITEMS" ? "MISSING_ITEM" : readIssue(booking.returnIssue)?.reason === "DAMAGED" ? "DAMAGE" : "OTHER"}
                    completed={!!booking.settlementCompletedAt}
                    settling={settlementPending}
                    canRefund={canOwnerManageDeposit && !booking.settlementDecision}
                  />
                )}
                {canOwnerManageDeposit && settlementPending && booking.depositClaim === null && (
                  <DepositActions settlementPending bookingId={id} depositZl={(booking.depositCents ?? 0) / 100} />
                )}
              </section>
            </>
          )}
        </>
      )}

      {(isOwner || isRenter) && booking.settlementCompletedAt && (
        <FinalSettlementSummary
          isOwner={isOwner}
          rentCents={booking.rentAmountCents}
          feeCents={isOwner ? booking.platformFeeCents : null}
          ownerTransferCents={isOwner && booking.ownerTransferId ? booking.ownerTransferCents : null}
          retainedCents={booking.depositRetainedCents}
          compensationCents={booking.depositTransferId ? booking.depositTransferredCents : booking.depositRetainedCents === 0 ? 0 : null}
          refundCents={booking.depositRefundedCents}
          refundRecorded={!!booking.depositRefundId}
          depositStatus={booking.depositStatus}
          completedAt={booking.settlementCompletedAt}
        />
      )}

      {/* ACCIONES DEL PROPIETARIO */}

           {isOwner && awaitingApproval && !approvalExpired && (
        <section className="p-4 border rounded bg-white">
          <h2 className="text-lg font-semibold mb-2">
            Akcje
          </h2>

          <div className="flex gap-3">
            <ApproveButton bookingId={id} phoneVerified={!!booking.owner.phoneVerifiedAt} />
            <RejectButton bookingId={id} />
          </div>
        </section>
      )}
    </div>
  );
}
