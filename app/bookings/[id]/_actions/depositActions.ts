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
    select: {
      id: true,
      bookingNumber: true,
      ownerId: true,
      status: true,

      depositCents: true,
      depositStatus: true,
      depositPaymentIntentId: true,
      depositRefundedCents: true,
      depositRetainedCents: true,

      returnConfirmationStatus: true,

      renter: {
        select: {
          name: true,
          email: true,
        },
      },
      listing: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!booking) throw new Error("Rezerwacja nie istnieje");
  if (booking.ownerId !== userId) throw new Error("Brak uprawnień");

  if (booking.status !== "PAID") {
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

export async function releaseDepositAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  if (!bookingId) throw new Error("Brak bookingId");

  const booking = await getOwnerBooking(bookingId, userId);

  const depositCents = booking.depositCents;
  if (depositCents == null || depositCents <= 0) {
    throw new Error("Ta rezerwacja nie ma kaucji");
  }

  if (booking.depositStatus !== "PAID") {
    throw new Error("Kaucja nie jest w stanie umożliwiającym zwrot");
  }

  const paymentIntentId = booking.depositPaymentIntentId;
  if (!paymentIntentId) {
    throw new Error("Brak depositPaymentIntentId");
  }

  const stripe = getStripe();

  try {
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: depositCents,
      metadata: {
        bookingId: booking.id,
        kind: "deposit_full_refund",
      },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        depositStatus: "REFUND_PENDING",
        depositLastError: null,
      },
    });

    if (booking.renter?.email) {
      await sendMail({
        to: booking.renter.email,
        subject: `Zwrot kaucji rozpoczęty #${booking.bookingNumber}: ${booking.listing.title ?? "Przedmiot"}`,
        html: `
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#111; line-height:1.5;">

  <p>Cześć ${booking.renter.name ?? ""},</p>

  <p>Rozpoczęliśmy zwrot <strong>całej kaucji</strong> dla rezerwacji <strong>#${booking.bookingNumber}</strong>.</p>

  <div style="margin:16px 0; padding:16px; border:1px solid #e5e7eb; border-radius:8px; background:#fafafa;">
    <p style="margin:0 0 8px 0; font-size:16px; font-weight:600;">
      ${booking.listing.title ?? "Przedmiot"}
    </p>

    <p style="margin:4px 0;">
      <strong>Numer rezerwacji:</strong> #${booking.bookingNumber}
    </p>

    <p style="margin:4px 0;">
      <strong>Kwota kaucji:</strong> ${moneyPLNFromCents(depositCents)}
    </p>
  </div>

  <p>
    Środki powinny wrócić na Twoją metodę płatności po przetworzeniu zwrotu przez Stripe i bank.
  </p>

  <p>
    <a href="${process.env.APP_URL}/bookings/${booking.id}"
       style="display:inline-block; margin-top:12px; padding:12px 18px;
              background:#111827; color:white; text-decoration:none;
              border-radius:6px; font-weight:600;">
      Zobacz rezerwację
    </a>
  </p>

  ${emailSignature()}

</div>
        `,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed";

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        depositLastError: message,
      },
    });

    throw err;
  }

  revalidatePath(`/bookings/${booking.id}`);
  revalidatePath(`/bookings`);
}

export async function retainDepositAction(formData: FormData) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  if (!bookingId) throw new Error("Brak bookingId");

  const booking = await getOwnerBooking(bookingId, userId);

  const depositCents = booking.depositCents;
  if (depositCents == null || depositCents <= 0) {
    throw new Error("Ta rezerwacja nie ma kaucji");
  }

  if (booking.depositStatus !== "PAID") {
    throw new Error("Kaucja nie jest w stanie umożliwiającym zatrzymanie");
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      depositStatus: "RETAINED",
      depositRefundedCents: 0,
      depositRetainedCents: depositCents,
      depositLastError: null,
    },
  });

  if (booking.renter?.email) {
    await sendMail({
      to: booking.renter.email,
      subject: `Kaucja zatrzymana #${booking.bookingNumber}: ${booking.listing.title ?? "Przedmiot"}`,
      html: `
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#111; line-height:1.5;">

  <p>Cześć ${booking.renter.name ?? ""},</p>

  <p>Kaucja dla rezerwacji <strong>#${booking.bookingNumber}</strong> została oznaczona jako <strong>zatrzymana</strong>.</p>

  <div style="margin:16px 0; padding:16px; border:1px solid #e5e7eb; border-radius:8px; background:#fafafa;">
    <p style="margin:0 0 8px 0; font-size:16px; font-weight:600;">
      ${booking.listing.title ?? "Przedmiot"}
    </p>

    <p style="margin:4px 0;">
      <strong>Numer rezerwacji:</strong> #${booking.bookingNumber}
    </p>

    <p style="margin:4px 0;">
      <strong>Zatrzymana kwota:</strong> ${moneyPLNFromCents(depositCents)}
    </p>
  </div>

  <p>
    Jeśli masz pytania dotyczące tej decyzji, skontaktuj się z właścicielem przez czat w aplikacji.
  </p>

  <p>
    <a href="${process.env.APP_URL}/bookings/${booking.id}"
       style="display:inline-block; margin-top:12px; padding:12px 18px;
              background:#111827; color:white; text-decoration:none;
              border-radius:6px; font-weight:600;">
      Zobacz rezerwację
    </a>
  </p>

  <div style="margin-top:18px; padding:14px; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; color:#991b1b;">
    <strong>Ważne:</strong><br/>
    Na tym etapie kaucja nie zostanie zwrócona.
  </div>

  ${emailSignature()}

</div>
      `,
    });
  }

  revalidatePath(`/bookings/${booking.id}`);
  revalidatePath(`/bookings`);
}