"use server";

import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/app/lib/mailer";

type ShippingStatus =
  | "NOT_REQUIRED"
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

export async function updateShippingAction(formData: FormData) {
  const session = (await getServerSession(authConfig)) as Session | null;
  const userId = session?.user?.id;
  if (!userId) throw new Error("Brak dostępu");

  const bookingId = String(formData.get("bookingId") || "");
  const rawStatus = String(formData.get("shippingStatus") || "");
  const carrier = String(formData.get("carrier") || "").trim();
  const trackingNumber = String(formData.get("trackingNumber") || "").trim();

  if (!bookingId) throw new Error("Brak bookingId");

  const allowed: ShippingStatus[] = [
    "NOT_REQUIRED",
    "PENDING",
    "READY",
    "SHIPPED",
    "DELIVERED",
    "LOST",
    "CANCELLED",
  ];

  const shippingStatus = rawStatus as ShippingStatus;
  if (!allowed.includes(shippingStatus)) {
    throw new Error("Nieprawidłowy status wysyłki");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      bookingNumber: true,
      status: true,
      shippingStatus: true,
      paymentStatus: true,
      shippedAt: true,
      deliveredAt: true,
      startDate: true,
      endDate: true,

      // permisos
      ownerId: true,

      // handshake entrega
      deliveryConfirmationStatus: true,
      deliveryConfirmBy: true,
      deliveryConfirmedAt: true,

      listing: {
        select: {
          title: true,
        },
      },
      renter: {
        select: {
          name: true,
          email: true,
        },
      },
      owner: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!booking) throw new Error("Rezerwacja nie istnieje");

  // solo owner
  if (booking.ownerId !== userId) {
    throw new Error("Brak uprawnień (tylko właściciel)");
  }

  // Puedes dejar CONFIRMED + PAID si quieres permitir preparar antes del pago.
  // Si prefieres alinear con la page, cambia a solo PAID.
 if (booking.status === "CANCELLED" || booking.paymentStatus !== "PAID") {
  throw new Error("Wysyłkę można edytować dopiero po opłaceniu rezerwacji");
}

  // bloqueo total si ya se cerró la entrega
  if (
    booking.deliveryConfirmationStatus === "CONFIRMED" ||
    booking.deliveryConfirmationStatus === "AUTO_CONFIRMED"
  ) {
    throw new Error("Nie można edytować — odbiór został już potwierdzony");
  }

  // si ya estaba marcada como delivered, no permitir más edición
  if (booking.shippingStatus === "DELIVERED") {
    throw new Error("Nie można edytować — przesyłka została dostarczona");
  }

  const now = new Date();

  const data: Prisma.BookingUpdateInput = {
    shippingStatus,
    carrier: carrier || null,
    trackingNumber: trackingNumber || null,

    ...(shippingStatus === "SHIPPED" && !booking.shippedAt
      ? { shippedAt: now }
      : {}),

    ...(shippingStatus === "DELIVERED" && !booking.deliveredAt
      ? { deliveredAt: now }
      : {}),
  };

  const shouldRequestDeliveryConfirmation =
    shippingStatus === "DELIVERED" &&
    booking.deliveryConfirmationStatus === "NOT_REQUESTED";

  if (shouldRequestDeliveryConfirmation) {
    data.deliveryConfirmationStatus = "AWAITING_CONFIRMATION";
    data.deliveryConfirmBy = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data,
  });

  if (shouldRequestDeliveryConfirmation) {
    const renterEmail = booking.renter?.email;

    if (renterEmail) {
      const ref = `#${booking.bookingNumber}`;
      const title = booking.listing?.title ?? "Przedmiot";
      const s = fmt(booking.startDate);
      const e = fmt(booking.endDate);

      await sendMail({
        to: renterEmail,
        subject: `Potwierdź odbiór ${ref}: ${title}`,
        html: `
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#111; line-height:1.5;">

  <p>Cześć ${booking.renter?.name ?? ""},</p>

  <p>Właściciel oznaczył dostawę jako <strong>dostarczoną</strong>.</p>

  <div style="margin:16px 0; padding:16px; border:1px solid #e5e7eb; border-radius:8px; background:#fafafa;">
    <p style="margin:0 0 8px 0; font-size:16px; font-weight:600;">
      ${title}
    </p>

    <p style="margin:4px 0;">
      <strong>Numer rezerwacji:</strong> ${ref}
    </p>

    <p style="margin:4px 0;">
      <strong>Daty rezerwacji:</strong> ${s} → ${e}
    </p>

    ${
      carrier
        ? `
    <p style="margin:4px 0;">
      <strong>Przewoźnik:</strong> ${carrier}
    </p>
    `
        : ""
    }

    ${
      trackingNumber
        ? `
    <p style="margin:4px 0;">
      <strong>Numer śledzenia:</strong> ${trackingNumber}
    </p>
    `
        : ""
    }
  </div>

  <p>
    Zaloguj się do panelu i potwierdź odbiór przedmiotu.
  </p>

  <p>
    <a href="${process.env.APP_URL}/bookings/${booking.id}"
       style="display:inline-block; margin-top:12px; padding:12px 18px;
              background:#111827; color:white; text-decoration:none;
              border-radius:6px; font-weight:600;">
      Potwierdź odbiór
    </a>
  </p>

  <div style="margin-top:18px; padding:14px; background:#dbeafe; border:1px solid #93c5fd; border-radius:8px; color:#1e3a8a;">
    <strong>Ważne:</strong><br/>
    Potwierdź odbiór dopiero wtedy, gdy rzeczywiście otrzymasz przedmiot.<br/>
    Jeśli wystąpił problem z dostawą, skontaktuj się z właścicielem przez czat.
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