"use server";

import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/app/lib/mailer";

const RETENTION_REASON_CODES = [
  "DAMAGE",
  "STAINING",
  "MISSING_ITEM",
  "LATE_RETURN",
  "CLEANING",
  "OTHER",
] as const;

type RetentionReasonCode =
  (typeof RETENTION_REASON_CODES)[number];

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Brak STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey, {
    apiVersion: "2025-09-30.clover",
  });
}

function emailSignature() {
  return `
    <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />

    <p style="margin:0;font-size:13px;color:#555;">
      Pozdrawiamy,<br/>
      <strong>Zespół MojaSzafa</strong>
    </p>

    <p style="margin-top:6px;font-size:11px;color:#888;">
      Ta wiadomość została wysłana automatycznie — prosimy na nią nie odpowiadać.
    </p>
  `;
}

function moneyPLNFromCents(value: number) {
  return `${new Intl.NumberFormat("pl-PL").format(value / 100)} zł`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getBookingUrl(bookingId: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    "";

  if (!baseUrl) {
    return "";
  }

  return `${baseUrl.replace(/\/$/, "")}/bookings/${bookingId}`;
}

function parseReasonCode(value: FormDataEntryValue | null) {
  const reasonCode = String(value || "");

  if (
    !RETENTION_REASON_CODES.includes(
      reasonCode as RetentionReasonCode
    )
  ) {
    throw new Error("Wybierz prawidłowy powód");
  }

  return reasonCode as RetentionReasonCode;
}

async function sendDepositEmail({
  to,
  subject,
  html,
}: {
  to?: string | null;
  subject: string;
  html: string;
}) {
  if (!to) {
    console.error("[DEPOSIT MAIL] Brak adresu e-mail najemcy");
    return;
  }

  try {
    await sendMail({
      to,
      subject,
      html: `${html}${emailSignature()}`,
    });
  } catch (error) {
    // El correo no debe cancelar ni repetir una operación de Stripe.
    console.error(
      "[DEPOSIT MAIL] Nie udało się wysłać wiadomości:",
      error
    );
  }
}

async function getOwnerBooking(
  bookingId: string,
  userId: string
) {
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
    include: {
      renter: true,
      listing: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!booking) {
    throw new Error("Rezerwacja nie istnieje");
  }

  if (booking.ownerId !== userId) {
    throw new Error("Brak uprawnień");
  }

  if (booking.paymentStatus !== "PAID") {
    throw new Error(
      "Kaucją można zarządzać dopiero po opłaceniu rezerwacji"
    );
  }

  const returnCompleted =
    booking.returnConfirmationStatus === "CONFIRMED" ||
    booking.returnConfirmationStatus === "AUTO_CONFIRMED";

  if (!returnCompleted) {
    throw new Error(
      "Kaucją można zarządzać dopiero po potwierdzeniu zwrotu"
    );
  }

  return booking;
}

function ensureDepositResolvable(booking: {
  depositCents: number | null;
  depositStatus: string;
  depositPaymentIntentId: string | null;
}) {
  if (!booking.depositCents || booking.depositCents <= 0) {
    throw new Error("Ta rezerwacja nie ma kaucji");
  }

  if (booking.depositStatus !== "PAID") {
    throw new Error("Kaucja została już rozliczona");
  }

  if (!booking.depositPaymentIntentId) {
    throw new Error("Brak depositPaymentIntentId");
  }

  return {
    depositCents: booking.depositCents,
    paymentIntentId: booking.depositPaymentIntentId,
  };
}

/* =========================
   FULL REFUND
========================= */

export async function releaseDepositAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Brak dostępu");
  }

  const bookingId = String(formData.get("bookingId") || "");

  const booking = await getOwnerBooking(bookingId, userId);

  const { depositCents, paymentIntentId } =
    ensureDepositResolvable(booking);

  const stripe = getStripe();

  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      amount: depositCents,
    },
    {
      idempotencyKey: `deposit-full-refund-${booking.id}`,
    }
  );

  await prisma.booking.update({
    where: {
      id: booking.id,
    },
    data: {
      depositStatus: "REFUND_PENDING",
      depositRefundId: refund.id,
      depositRefundedCents: depositCents,
      depositRetainedCents: 0,
      depositDecisionAt: new Date(),
      depositDecisionById: userId,
      depositRetentionReason: null,
      depositRetentionReasonCode: null,
    },
  });

  const bookingUrl = getBookingUrl(booking.id);

  await sendDepositEmail({
    to: booking.renter.email,
    subject:
      `Zwrot kaucji #${booking.bookingNumber}: ` +
      `${booking.listing.title}`,
    html: `
      <p style="margin:0 0 24px;color:#18181b;">
        Cześć ${escapeHtml(booking.renter.name || "")},
      </p>

      <p style="margin:0 0 18px;color:#18181b;">
        Właściciel zdecydował o zwrocie pełnej kaucji
        dla rezerwacji <strong>#${booking.bookingNumber}</strong>.
      </p>

      <div style="
        margin:20px 0;
        padding:18px;
        border:1px solid #e4e4e7;
        border-radius:9px;
        background:#fafafa;
      ">
        <p style="margin:0 0 14px;font-size:17px;color:#18181b;">
          <strong>${escapeHtml(booking.listing.title)}</strong>
        </p>

        <p style="margin:0 0 8px;color:#18181b;">
          <strong>Numer rezerwacji:</strong>
          #${booking.bookingNumber}
        </p>

        <p style="margin:0 0 8px;color:#18181b;">
          <strong>Pobrana kaucja:</strong>
          ${moneyPLNFromCents(depositCents)}
        </p>

        <p style="margin:0;color:#166534;">
          <strong>Kwota zwrotu:</strong>
          ${moneyPLNFromCents(depositCents)}
        </p>
      </div>

      <div style="
        margin:20px 0;
        padding:14px;
        border:1px solid #86efac;
        border-radius:8px;
        background:#f0fdf4;
        color:#166534;
      ">
        <strong>Pełny zwrot kaucji został zlecony.</strong>

        <p style="margin:7px 0 0;">
          Czas zaksięgowania środków zależy od banku
          lub operatora karty.
        </p>
      </div>

      ${
        bookingUrl
          ? `
            <p style="margin:26px 0;">
              <a
                href="${bookingUrl}"
                style="
                  display:inline-block;
                  padding:13px 18px;
                  border-radius:6px;
                  background:#111827;
                  color:#ffffff;
                  font-weight:700;
                  text-decoration:none;
                "
              >
                Zobacz rezerwację
              </a>
            </p>
          `
          : ""
      }
    `,
  });

  revalidatePath(`/bookings/${booking.id}`);
}

/* =========================
   PARTIAL REFUND
========================= */

export async function partialReleaseDepositAction(
  formData: FormData
) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Brak dostępu");
  }

  const bookingId = String(formData.get("bookingId") || "");
  const refundZl = Number(
    formData.get("refundAmountZl") || "0"
  );
  const reason = String(formData.get("reason") || "").trim();
  const reasonCode = parseReasonCode(
    formData.get("reasonCode")
  );

  const booking = await getOwnerBooking(bookingId, userId);

  const { depositCents, paymentIntentId } =
    ensureDepositResolvable(booking);

  const refundCents = Math.round(refundZl * 100);

  if (refundCents <= 0 || refundCents >= depositCents) {
    throw new Error("Nieprawidłowa kwota");
  }

  if (!reason) {
    throw new Error("Podaj powód");
  }

  const retainedCents = depositCents - refundCents;
  const stripe = getStripe();

  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      amount: refundCents,
    },
    {
      idempotencyKey: `deposit-partial-refund-${booking.id}`,
    }
  );

  await prisma.booking.update({
    where: {
      id: booking.id,
    },
    data: {
      depositStatus: "REFUND_PENDING",
      depositRefundId: refund.id,
      depositRefundedCents: refundCents,
      depositRetainedCents: retainedCents,
      depositRetentionReason: reason,
      depositRetentionReasonCode: reasonCode,
      depositDecisionAt: new Date(),
      depositDecisionById: userId,
    },
  });

  const bookingUrl = getBookingUrl(booking.id);

  await sendDepositEmail({
    to: booking.renter.email,
    subject:
      `Kaucja częściowo zwrócona #${booking.bookingNumber}: ` +
      `${booking.listing.title}`,
    html: `
      <p style="margin:0 0 24px;color:#18181b;">
        Cześć ${escapeHtml(booking.renter.name || "")},
      </p>

      <p style="margin:0 0 18px;color:#18181b;">
        Kaucja dla rezerwacji
        <strong>#${booking.bookingNumber}</strong>
        została częściowo zwrócona.
      </p>

      <div style="
        margin:20px 0;
        padding:18px;
        border:1px solid #e4e4e7;
        border-radius:9px;
        background:#fafafa;
      ">
        <p style="margin:0 0 14px;font-size:17px;color:#18181b;">
          <strong>${escapeHtml(booking.listing.title)}</strong>
        </p>

        <p style="margin:0 0 8px;color:#18181b;">
          <strong>Numer rezerwacji:</strong>
          #${booking.bookingNumber}
        </p>

        <p style="margin:0 0 8px;color:#18181b;">
          <strong>Pobrana kaucja:</strong>
          ${moneyPLNFromCents(depositCents)}
        </p>

        <p style="margin:0 0 8px;color:#166534;">
          <strong>Kwota zwrotu:</strong>
          ${moneyPLNFromCents(refundCents)}
        </p>

        <p style="margin:0;color:#991b1b;">
          <strong>Kwota zatrzymana:</strong>
          ${moneyPLNFromCents(retainedCents)}
        </p>
      </div>

      <div style="
        margin:20px 0;
        padding:14px;
        border:1px solid #fde68a;
        border-radius:8px;
        background:#fffbeb;
        color:#854d0e;
      ">
        <strong>Powód zatrzymania części kaucji:</strong>

        <p style="margin:7px 0 0;">
          ${escapeHtml(reason)}
        </p>
      </div>

      <p style="margin:20px 0;color:#18181b;">
        Zwracana kwota została przekazana do realizacji.
        Czas zaksięgowania zależy od banku lub operatora karty.
      </p>

      <p style="margin:20px 0;color:#18181b;">
        Jeśli masz pytania dotyczące tej decyzji,
        skontaktuj się z właścicielem przez czat w aplikacji.
      </p>

      ${
        bookingUrl
          ? `
            <p style="margin:26px 0;">
              <a
                href="${bookingUrl}"
                style="
                  display:inline-block;
                  padding:13px 18px;
                  border-radius:6px;
                  background:#111827;
                  color:#ffffff;
                  font-weight:700;
                  text-decoration:none;
                "
              >
                Zobacz rezerwację
              </a>
            </p>
          `
          : ""
      }

      <div style="
        margin:20px 0 0;
        padding:14px;
        border:1px solid #fca5a5;
        border-radius:8px;
        background:#fef2f2;
        color:#991b1b;
      ">
        <strong>Ważne:</strong><br/>
        Zatrzymana część kaucji nie zostanie zwrócona.
      </div>
    `,
  });

  revalidatePath(`/bookings/${booking.id}`);
}

/* =========================
   FULL RETAIN
========================= */

export async function retainDepositAction(
  formData: FormData
) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Brak dostępu");
  }

  const bookingId = String(formData.get("bookingId") || "");
  const reason = String(formData.get("reason") || "").trim();
  const reasonCode = parseReasonCode(
    formData.get("reasonCode")
  );

  if (!reason) {
    throw new Error("Podaj powód");
  }

  const booking = await getOwnerBooking(bookingId, userId);
  const { depositCents } = ensureDepositResolvable(booking);

  await prisma.booking.update({
    where: {
      id: booking.id,
    },
    data: {
      depositStatus: "RETAINED",
      depositRefundedCents: 0,
      depositRetainedCents: depositCents,
      depositRetentionReason: reason,
      depositRetentionReasonCode: reasonCode,
      depositDecisionAt: new Date(),
      depositDecisionById: userId,
    },
  });

  const bookingUrl = getBookingUrl(booking.id);

  await sendDepositEmail({
    to: booking.renter.email,
    subject:
      `Kaucja zatrzymana #${booking.bookingNumber}: ` +
      `${booking.listing.title}`,
    html: `
      <p style="margin:0 0 24px;color:#18181b;">
        Cześć ${escapeHtml(booking.renter.name || "")},
      </p>

      <p style="margin:0 0 18px;color:#18181b;">
        Kaucja dla rezerwacji
        <strong>#${booking.bookingNumber}</strong>
        została oznaczona jako
        <strong>zatrzymana</strong>.
      </p>

      <div style="
        margin:20px 0;
        padding:18px;
        border:1px solid #e4e4e7;
        border-radius:9px;
        background:#fafafa;
      ">
        <p style="margin:0 0 14px;font-size:17px;color:#18181b;">
          <strong>${escapeHtml(booking.listing.title)}</strong>
        </p>

        <p style="margin:0 0 8px;color:#18181b;">
          <strong>Numer rezerwacji:</strong>
          #${booking.bookingNumber}
        </p>

        <p style="margin:0;color:#991b1b;">
          <strong>Zatrzymana kwota:</strong>
          ${moneyPLNFromCents(depositCents)}
        </p>
      </div>

      <div style="
        margin:20px 0;
        padding:14px;
        border:1px solid #fde68a;
        border-radius:8px;
        background:#fffbeb;
        color:#854d0e;
      ">
        <strong>Powód zatrzymania kaucji:</strong>

        <p style="margin:7px 0 0;">
          ${escapeHtml(reason)}
        </p>
      </div>

      <p style="margin:20px 0;color:#18181b;">
        Jeśli masz pytania dotyczące tej decyzji,
        skontaktuj się z właścicielem przez czat w aplikacji.
      </p>

      ${
        bookingUrl
          ? `
            <p style="margin:26px 0;">
              <a
                href="${bookingUrl}"
                style="
                  display:inline-block;
                  padding:13px 18px;
                  border-radius:6px;
                  background:#111827;
                  color:#ffffff;
                  font-weight:700;
                  text-decoration:none;
                "
              >
                Zobacz rezerwację
              </a>
            </p>
          `
          : ""
      }

      <div style="
        margin:20px 0 0;
        padding:14px;
        border:1px solid #fca5a5;
        border-radius:8px;
        background:#fef2f2;
        color:#991b1b;
      ">
        <strong>Ważne:</strong><br/>
        Na tym etapie kaucja nie zostanie zwrócona.
      </div>
    `,
  });

  revalidatePath(`/bookings/${booking.id}`);
}