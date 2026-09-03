"use server";

import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/app/lib/mailer";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Brak STRIPE_SECRET_KEY");

  return new Stripe(secretKey, {
    apiVersion: "2025-09-30.clover",
  });
}

function emailSignature() {
  return `
    <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
    <p style="margin:0; font-size:13px; color:#555;">
      Pozdrawiamy,<br/>
      <strong>Zespół MojaSzafa</strong>
    </p>
    <p style="margin-top:6px; font-size:11px; color:#888;">
      Ta wiadomość została wysłana automatycznie — prosimy na nią nie odpowiadać.
    </p>
  `;
}

function moneyPLNFromCents(v: number) {
  return `${new Intl.NumberFormat("pl-PL").format(v / 100)} zł`;
}

async function getOwnerBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      renter: true,
      listing: { include: { user: true } },
    },
  });

  if (!booking) throw new Error("Rezerwacja nie istnieje");
  if (booking.ownerId !== userId) throw new Error("Brak uprawnień");

  if (booking.paymentStatus !== "PAID") {
    throw new Error("Kaucją można zarządzać dopiero po opłaceniu rezerwacji");
  }

  const returnCompleted =
    booking.returnConfirmationStatus === "CONFIRMED" ||
    booking.returnConfirmationStatus === "AUTO_CONFIRMED";

  if (!returnCompleted) {
    throw new Error("Kaucją można zarządzać dopiero po potwierdzeniu zwrotu");
  }

  return booking;
}

function ensureDepositResolvable(booking: any) {
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
  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  const booking = await getOwnerBooking(bookingId, userId);
  const { depositCents, paymentIntentId } = ensureDepositResolvable(booking);

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
  where: { id: booking.id },
  data: {
    depositStatus: "REFUND_PENDING",
    depositRefundId: refund.id,
    depositRefundedCents: depositCents,
    depositRetainedCents: 0,
    depositDecisionAt: new Date(),
    depositDecisionById: userId,
    depositRetentionReason: null,
  },
});

  revalidatePath(`/bookings/${booking.id}`);
}

/* =========================
   PARTIAL REFUND
========================= */
export async function partialReleaseDepositAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  const refundZl = Number(formData.get("refundAmountZl") || "0");
  const reason = String(formData.get("reason") || "").trim();

  const booking = await getOwnerBooking(bookingId, userId);
  const { depositCents, paymentIntentId } = ensureDepositResolvable(booking);

  const refundCents = Math.round(refundZl * 100);

  if (refundCents <= 0 || refundCents >= depositCents) {
    throw new Error("Nieprawidłowa kwota");
  }

  if (!reason) {
    throw new Error("Podaj powód");
  }

  const retained = depositCents - refundCents;

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
  where: { id: booking.id },
  data: {
    depositStatus: "REFUND_PENDING",
    depositRefundId: refund.id,
    depositRefundedCents: refundCents,
    depositRetainedCents: retained,
    depositRetentionReason: reason,
    depositDecisionAt: new Date(),
    depositDecisionById: userId,
  },
});
  revalidatePath(`/bookings/${booking.id}`);
}

/* =========================
   FULL RETAIN
========================= */
export async function retainDepositAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (!reason) throw new Error("Podaj powód");

  const booking = await getOwnerBooking(bookingId, userId);
  const { depositCents } = ensureDepositResolvable(booking);

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      depositStatus: "RETAINED",
      depositRefundedCents: 0,
      depositRetainedCents: depositCents,
      depositRetentionReason: reason,
      depositDecisionAt: new Date(),
      depositDecisionById: userId,
    },
  });

  revalidatePath(`/bookings/${booking.id}`);
}