"use server";

import { tryInviteBookingReview } from "@/app/lib/reviewInvitations";
import Stripe from "stripe";
import { lockSettlementDecision, settlementOperation, finishSettlement, type SettlementDecision } from "@/app/lib/settlement";
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

type OwnerBooking = Awaited<
  ReturnType<typeof getOwnerBooking>
>;

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

function parseReasonCode(
  value: FormDataEntryValue | null
) {
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
    console.error(
      "[DEPOSIT MAIL] Brak adresu e-mail najemcy"
    );
    return;
  }

  try {
    await sendMail({
      to,
      subject,
      html: `${html}${emailSignature()}`,
    });
  } catch (error) {
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

/* =========================
   VALIDATION
========================= */

function getDepositData(booking: OwnerBooking) {
  if (
    booking.depositCents == null ||
    booking.depositCents <= 0
  ) {
    throw new Error("Ta rezerwacja nie ma kaucji");
  }

  if (!booking.depositPaymentIntentId) {
    throw new Error("Brak depositPaymentIntentId");
  }

  return {
    depositCents: booking.depositCents,
    paymentIntentId:
      booking.depositPaymentIntentId,
  };
}

function ensureNewDepositDecision(
  booking: OwnerBooking
) {
  if (booking.settlementDecision && !booking.settlementCompletedAt) return;

  if (booking.depositStatus !== "PAID") {
    throw new Error("Kaucja została już rozliczona");
  }

  if (booking.depositDecisionAt) {
    throw new Error(
      "Decyzja dotycząca kaucji została już podjęta"
    );
  }
}

function validateEconomicSnapshot(
  booking: OwnerBooking
) {
  if (
    booking.rentAmountCents == null ||
    booking.platformFeeCents == null ||
    booking.ownerPayoutCents == null ||
    booking.ownerPayoutCents <= 0
  ) {
    throw new Error(
      "Brak kompletnego snapshotu ekonomicznego rezerwacji"
    );
  }

  if (
    booking.rentAmountCents !==
    booking.platformFeeCents +
      booking.ownerPayoutCents
  ) {
    throw new Error(
      "Nieprawidłowy snapshot ekonomiczny rezerwacji"
    );
  }

  return {
    ownerPayoutCents:
      booking.ownerPayoutCents,
  };
}

async function ensureOwnerConnectReady(
  booking: OwnerBooking
) {
  const stripeAccountId =
    booking.listing.user.stripeAccountId;

  if (!stripeAccountId) {
    throw new Error(
      "Właściciel nie ma skonfigurowanego konta wypłat"
    );
  }

  const stripe = getStripe();

  const account =
    await stripe.accounts.retrieve(
      stripeAccountId
    );

  if (
    account.details_submitted !== true ||
    account.payouts_enabled !== true ||
    account.capabilities?.transfers !== "active"
  ) {
    throw new Error(
      "Konto wypłat właściciela nie jest aktywne"
    );
  }

  return stripeAccountId;
}

/* =========================
   STRIPE OPERATIONS
========================= */

async function prepareSettlement(
  booking: OwnerBooking, kind: SettlementDecision["kind"], refundCents: number,
  reason: string | null = null, reasonCode: string | null = null,
) {
  const saved = booking.settlementDecision as SettlementDecision | null;
  const destination = saved?.destination ?? await ensureOwnerConnectReady(booking);
  const decision = await lockSettlementDecision(booking.id, {
    kind, refundCents, retainedCents: getDepositData(booking).depositCents - refundCents,
    reason, reasonCode, destination,
    paymentIntent: saved?.paymentIntent ?? getDepositData(booking).paymentIntentId,
    ownerCents: saved?.ownerCents ?? validateEconomicSnapshot(booking).ownerPayoutCents,
  });
  booking.settlementDecision = decision;
}

async function createOwnerRentalTransfer(booking: OwnerBooking) {
  if (booking.ownerTransferId) return { id: booking.ownerTransferId, amount: booking.ownerTransferCents! };
  const decision = booking.settlementDecision as SettlementDecision;
  return settlementOperation(getStripe(), booking.id, "rent", {
    amount: decision.ownerCents, currency: "pln", destination: decision.destination,
    metadata: { bookingId: booking.id, bookingNumber: String(booking.bookingNumber), type: "rental_owner_payout" },
  });
}

async function createDepositCompensationTransfer(booking: OwnerBooking, retainedCents: number) {
  if (retainedCents <= 0) return null;
  if (booking.depositTransferId) return { id: booking.depositTransferId, amount: booking.depositTransferredCents! };
  const decision = booking.settlementDecision as SettlementDecision;
  return settlementOperation(getStripe(), booking.id, "compensation", {
    amount: decision.retainedCents, currency: "pln", destination: decision.destination,
    metadata: { bookingId: booking.id, bookingNumber: String(booking.bookingNumber), type: "deposit_compensation" },
  });
}

async function createDepositRefund(booking: OwnerBooking, refundCents: number, kind: "full" | "partial") {
  if (booking.depositRefundId) return { id: booking.depositRefundId, amount: booking.depositRefundedCents! };
  const decision = booking.settlementDecision as SettlementDecision;
  if (refundCents !== decision.refundCents || kind !== decision.kind) throw new Error("Niezgodna decyzja zwrotu");
  return settlementOperation(getStripe(), booking.id, "refund", {
    amount: decision.refundCents, payment_intent: decision.paymentIntent,
    metadata: { bookingId: booking.id, type: "deposit_refund" },
  });
}

/* =========================
   FULL REFUND
========================= */

export async function releaseDepositAction(
  formData: FormData
) {
  const session =
    await getServerSession(authConfig);

  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Brak dostępu");
  }

  const bookingId = String(
    formData.get("bookingId") || ""
  );

  const booking =
    await getOwnerBooking(
      bookingId,
      userId
    );

  ensureNewDepositDecision(booking);

  const { depositCents } =
    getDepositData(booking);


  await prepareSettlement(booking, "full", depositCents);

  const ownerTransfer =
    await createOwnerRentalTransfer(booking);

  const refund =
    await createDepositRefund(
      booking,
      depositCents,
      "full"
    );

  const completed = await finishSettlement(booking.id, {
      depositStatus: "REFUND_PENDING",

      depositRefundId: refund.id,
      depositRefundedCents:
        depositCents,
      depositRetainedCents: 0,

      depositDecisionAt: new Date(),
      depositDecisionById: userId,
      depositRetentionReason: null,
      depositRetentionReasonCode: null,

      ownerTransferId:
        ownerTransfer.id,
      ownerTransferCents:
        ownerTransfer.amount,
      ownerTransferredAt: new Date(),

      depositTransferId: null,
      depositTransferredCents: null,
      depositTransferredAt: null,
  });
  await tryInviteBookingReview(booking.id);
  if (!completed) return;

  console.log(
    "[SETTLEMENT] full refund completed",
    booking.id
  );

  const bookingUrl =
    getBookingUrl(booking.id);

  await sendDepositEmail({
    to: booking.renter.email,

    subject:
      `Zwrot kaucji #${booking.bookingNumber}: ` +
      `${booking.listing.title}`,

    html: `
      <p style="margin:0 0 24px;color:#18181b;">
        Cześć ${escapeHtml(
          booking.renter.name || ""
        )},
      </p>

      <p style="margin:0 0 18px;color:#18181b;">
        Właściciel zdecydował o zwrocie pełnej kaucji
        dla rezerwacji
        <strong>#${booking.bookingNumber}</strong>.
      </p>

      <div style="
        margin:20px 0;
        padding:18px;
        border:1px solid #e4e4e7;
        border-radius:9px;
        background:#fafafa;
      ">
        <p style="margin:0 0 14px;font-size:17px;color:#18181b;">
          <strong>${escapeHtml(
            booking.listing.title
          )}</strong>
        </p>

        <p style="margin:0 0 8px;color:#18181b;">
          <strong>Pobrana kaucja:</strong>
          ${moneyPLNFromCents(
            depositCents
          )}
        </p>

        <p style="margin:0;color:#166534;">
          <strong>Kwota zwrotu:</strong>
          ${moneyPLNFromCents(
            depositCents
          )}
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
        <strong>
          Pełny zwrot kaucji został zlecony.
        </strong>

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

  revalidatePath(
    `/bookings/${booking.id}`
  );
}

/* =========================
   PARTIAL REFUND
========================= */

export async function partialReleaseDepositAction(
  formData: FormData
) {
  const session =
    await getServerSession(authConfig);

  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Brak dostępu");
  }

  const bookingId = String(
    formData.get("bookingId") || ""
  );

  const refundZl = Number(
    formData.get("refundAmountZl") || "0"
  );

  const reason = String(
    formData.get("reason") || ""
  ).trim();

  const reasonCode =
    parseReasonCode(
      formData.get("reasonCode")
    );

  if (!reason) {
    throw new Error("Podaj powód");
  }

  const booking =
    await getOwnerBooking(
      bookingId,
      userId
    );

  ensureNewDepositDecision(booking);

  const { depositCents } =
    getDepositData(booking);

  const refundCents =
    Math.round(refundZl * 100);

  if (
    !Number.isSafeInteger(refundCents) ||
    refundCents <= 0 ||
    refundCents >= depositCents
  ) {
    throw new Error(
      "Nieprawidłowa kwota"
    );
  }

  const retainedCents =
    depositCents - refundCents;

  /*
   * 1. payout alquiler owner
   * 2. refund parcial renter
   * 3. compensación owner
   *
   * La decisión y cada intento se persisten antes de llamar a Stripe.
   */

  await prepareSettlement(booking, "partial", refundCents, reason, reasonCode);

  const ownerTransfer =
    await createOwnerRentalTransfer(booking);

  const refund =
    await createDepositRefund(
      booking,
      refundCents,
      "partial"
    );

  const depositTransfer =
    await createDepositCompensationTransfer(
      booking,
      retainedCents
    );

  if (!depositTransfer) {
    throw new Error(
      "Brak transferu kompensaty z kaucji"
    );
  }

  const completed = await finishSettlement(booking.id, {
      depositStatus: "REFUND_PENDING",

      depositRefundId: refund.id,
      depositRefundedCents:
        refundCents,
      depositRetainedCents:
        retainedCents,

      depositRetentionReason:
        reason,
      depositRetentionReasonCode:
        reasonCode,

      depositDecisionAt: new Date(),
      depositDecisionById: userId,

      ownerTransferId:
        ownerTransfer.id,
      ownerTransferCents:
        ownerTransfer.amount,
      ownerTransferredAt: new Date(),

      depositTransferId:
        depositTransfer.id,
      depositTransferredCents:
        depositTransfer.amount,
      depositTransferredAt: new Date(),
  });
  await tryInviteBookingReview(booking.id);
  if (!completed) return;

  console.log(
    "[SETTLEMENT] partial refund completed",
    booking.id
  );

  const bookingUrl =
    getBookingUrl(booking.id);

  await sendDepositEmail({
    to: booking.renter.email,

    subject:
      `Kaucja częściowo zwrócona #${booking.bookingNumber}: ` +
      `${booking.listing.title}`,

    html: `
      <p style="margin:0 0 24px;color:#18181b;">
        Cześć ${escapeHtml(
          booking.renter.name || ""
        )},
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
          <strong>${escapeHtml(
            booking.listing.title
          )}</strong>
        </p>

        <p style="margin:0 0 8px;color:#18181b;">
          <strong>Pobrana kaucja:</strong>
          ${moneyPLNFromCents(
            depositCents
          )}
        </p>

        <p style="margin:0 0 8px;color:#166534;">
          <strong>Kwota zwrotu:</strong>
          ${moneyPLNFromCents(
            refundCents
          )}
        </p>

        <p style="margin:0;color:#991b1b;">
          <strong>Kwota zatrzymana:</strong>
          ${moneyPLNFromCents(
            retainedCents
          )}
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
        <strong>
          Powód zatrzymania części kaucji:
        </strong>

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

  revalidatePath(
    `/bookings/${booking.id}`
  );
}

/* =========================
   FULL RETAIN
========================= */

export async function retainDepositAction(
  formData: FormData
) {
  const session =
    await getServerSession(authConfig);

  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Brak dostępu");
  }

  const bookingId = String(
    formData.get("bookingId") || ""
  );

  const reason = String(
    formData.get("reason") || ""
  ).trim();

  const reasonCode =
    parseReasonCode(
      formData.get("reasonCode")
    );

  if (!reason) {
    throw new Error("Podaj powód");
  }

  const booking =
    await getOwnerBooking(
      bookingId,
      userId
    );

  ensureNewDepositDecision(booking);

  const { depositCents } =
    getDepositData(booking);

  /*
   * No existe refund.
   *
   * El owner recibe:
   * - alquiler neto
   * - kaucja completa como compensación
   */

  await prepareSettlement(booking, "retain", 0, reason, reasonCode);

  const ownerTransfer =
    await createOwnerRentalTransfer(booking);

  const depositTransfer =
    await createDepositCompensationTransfer(
      booking,
      depositCents
    );

  if (!depositTransfer) {
    throw new Error(
      "Brak transferu kompensaty z kaucji"
    );
  }

  const completed = await finishSettlement(booking.id, {
      depositStatus: "RETAINED",

      depositRefundId: null,
      depositRefundedCents: 0,
      depositRetainedCents:
        depositCents,

      depositRetentionReason:
        reason,
      depositRetentionReasonCode:
        reasonCode,

      depositDecisionAt: new Date(),
      depositDecisionById: userId,

      ownerTransferId:
        ownerTransfer.id,
      ownerTransferCents:
        ownerTransfer.amount,
      ownerTransferredAt: new Date(),

      depositTransferId:
        depositTransfer.id,
      depositTransferredCents:
        depositTransfer.amount,
      depositTransferredAt: new Date(),
  });
  await tryInviteBookingReview(booking.id);
  if (!completed) return;

  console.log(
    "[SETTLEMENT] full retain completed",
    booking.id
  );

  const bookingUrl =
    getBookingUrl(booking.id);

  await sendDepositEmail({
    to: booking.renter.email,

    subject:
      `Kaucja zatrzymana #${booking.bookingNumber}: ` +
      `${booking.listing.title}`,

    html: `
      <p style="margin:0 0 24px;color:#18181b;">
        Cześć ${escapeHtml(
          booking.renter.name || ""
        )},
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
          <strong>${escapeHtml(
            booking.listing.title
          )}</strong>
        </p>

        <p style="margin:0;color:#991b1b;">
          <strong>Zatrzymana kwota:</strong>
          ${moneyPLNFromCents(
            depositCents
          )}
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
        <strong>
          Powód zatrzymania kaucji:
        </strong>

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

  revalidatePath(
    `/bookings/${booking.id}`
  );
}
// Retry derives all financial inputs from the persisted decision, never the form.
export async function retrySettlementAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) throw new Error("Brak dostępu");
  const booking = await getOwnerBooking(String(formData.get("bookingId") || ""), session.user.id);
  if (booking.settlementCompletedAt) return;
  const saved = booking.settlementDecision as SettlementDecision | null;
  if (!saved) throw new Error("Brak rozpoczętego rozliczenia");
  const retry = new FormData();
  retry.set("bookingId", booking.id);
  retry.set("refundAmountZl", String(saved.refundCents / 100));
  retry.set("reason", saved.reason ?? "");
  retry.set("reasonCode", saved.reasonCode ?? "");
  if (saved.kind === "full") await releaseDepositAction(retry);
  else if (saved.kind === "partial") await partialReleaseDepositAction(retry);
  else await retainDepositAction(retry);
}
