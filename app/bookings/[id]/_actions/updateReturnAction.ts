"use server";

import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/app/lib/mailer";

type ReturnStatus =
  | "PENDING"
  | "READY"
  | "SHIPPED"
  | "DELIVERED"
  | "LOST"
  | "CANCELLED";

function fmt(d: Date | string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
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

export async function updateReturnAction(formData: FormData) {
  const session = (await getServerSession(authConfig)) as Session | null;
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  const rawReturnStatus = String(formData.get("returnStatus") || "");
  const returnCarrier = String(formData.get("returnCarrier") || "").trim();
  const returnTrackingNumber = String(formData.get("returnTrackingNumber") || "").trim();

  if (!bookingId) throw new Error("Brak bookingId");

  const normalizedReturnStatus =
    rawReturnStatus === "RETURN_PENDING"
      ? "PENDING"
      : rawReturnStatus === "RETURNED"
      ? "DELIVERED"
      : rawReturnStatus;

  const returnStatus = normalizedReturnStatus as ReturnStatus;
  const allowed: ReturnStatus[] = [
    "PENDING",
    "READY",
    "SHIPPED",
    "DELIVERED",
    "LOST",
    "CANCELLED",
  ];

  if (!allowed.includes(returnStatus)) {
    throw new Error("Nieprawidłowy status zwrotu");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      bookingNumber: true,
      status: true,
      renterId: true,
      startDate: true,
      endDate: true,

      shippingStatus: true,
      deliveryConfirmationStatus: true,

      returnStatus: true,
      returnCarrier: true,
      returnTrackingNumber: true,
      returnShippedAt: true,
      returnDeliveredAt: true,

      returnConfirmationStatus: true,
      returnConfirmBy: true,
      returnConfirmedAt: true,

      listing: {
        select: {
          title: true,
        },
      },
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
      renter: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!booking) throw new Error("Rezerwacja nie istnieje");

  if (booking.renterId !== userId) {
    throw new Error("Brak uprawnień (tylko najemca)");
  }

  if (booking.status !== "PAID") {
    throw new Error("Zwrot można uzupełnić dopiero po opłaceniu rezerwacji");
  }

  const deliveryCompleted =
    booking.shippingStatus === "DELIVERED" &&
    (booking.deliveryConfirmationStatus === "CONFIRMED" ||
      booking.deliveryConfirmationStatus === "AUTO_CONFIRMED");

  if (!deliveryCompleted) {
    throw new Error("Zwrot można uzupełnić dopiero po potwierdzeniu dostawy");
  }

  if (
    booking.returnConfirmationStatus === "CONFIRMED" ||
    booking.returnConfirmationStatus === "AUTO_CONFIRMED"
  ) {
    throw new Error("Nie można edytować — zwrot został zakończony");
  }

  const now = new Date();

  const data: Prisma.BookingUpdateInput = {
    returnStatus,
    returnCarrier: returnCarrier || null,
    returnTrackingNumber: returnTrackingNumber || null,

    ...(returnStatus === "SHIPPED" && !booking.returnShippedAt
      ? { returnShippedAt: now }
      : {}),

    ...(returnStatus === "DELIVERED" && !booking.returnDeliveredAt
      ? { returnDeliveredAt: now }
      : {}),
  };

  const shouldRequestReturnConfirmation =
    returnStatus === "DELIVERED" &&
    booking.returnConfirmationStatus === "NOT_REQUESTED";

  if (shouldRequestReturnConfirmation) {
    data.returnConfirmationStatus = "AWAITING_CONFIRMATION";
    data.returnConfirmBy = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data,
  });

  if (shouldRequestReturnConfirmation) {
    const ownerEmail = booking.owner?.email;

    if (ownerEmail) {
      const ref = `#${booking.bookingNumber}`;
      const title = booking.listing?.title ?? "Przedmiot";
      const s = fmt(booking.startDate);
      const e = fmt(booking.endDate);

      await sendMail({
        to: ownerEmail,
        subject: `Potwierdź zwrot ${ref}: ${title}`,
        html: `
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#111; line-height:1.5;">

  <p>Cześć ${booking.owner?.name ?? ""},</p>

  <p>Najemca oznaczył zwrot jako <strong>dostarczony</strong>.</p>

  <div style="margin:16px 0; padding:16px; border:1px solid #e5e7eb; border-radius:8px; background:#fafafa;">
    <p style="margin:0 0 8px 0; font-size:16px; font-weight:600;">
      ${title}
    </p>

    <p style="margin:4px 0;">
      <strong>Numer rezerwacji:</strong> ${ref}
    </p>

    <p style="margin:4px 0;">
      <strong>Najemca:</strong> ${booking.renter?.name ?? "Użytkownik"}
    </p>

    <p style="margin:4px 0;">
      <strong>Daty rezerwacji:</strong> ${s} → ${e}
    </p>

    ${
      returnCarrier
        ? `
    <p style="margin:4px 0;">
      <strong>Przewoźnik zwrotu:</strong> ${returnCarrier}
    </p>
    `
        : ""
    }

    ${
      returnTrackingNumber
        ? `
    <p style="margin:4px 0;">
      <strong>Numer śledzenia zwrotu:</strong> ${returnTrackingNumber}
    </p>
    `
        : ""
    }
  </div>

  <p>
    Zaloguj się do panelu i potwierdź odbiór zwracanego przedmiotu.
  </p>

  <p>
    <a href="${process.env.APP_URL}/bookings/${booking.id}"
       style="display:inline-block; margin-top:12px; padding:12px 18px;
              background:#111827; color:white; text-decoration:none;
              border-radius:6px; font-weight:600;">
      Potwierdź zwrot
    </a>
  </p>

  <div style="margin-top:18px; padding:14px; background:#dbeafe; border:1px solid #93c5fd; border-radius:8px; color:#1e3a8a;">
    <strong>Ważne:</strong><br/>
    Potwierdź zwrot dopiero po faktycznym otrzymaniu przedmiotu.<br/>
    Po potwierdzeniu zwrotu będzie można rozliczyć kaucję.
  </div>

  ${emailSignature()}

</div>
        `,
      });
    }
  }

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/bookings`);
}