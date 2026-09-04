// app/bookings/actions.ts
"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/app/lib/mailer";

/* ============================================
   CONFIGURACIÓN ECONÓMICA
=============================================== */

// Basis points:
// 1500 = 15.00%
// 1000 = 10.00%
// 2000 = 20.00%
const PLATFORM_FEE_RATE = 1500;

/* ============================================
   UTILIDADES
=============================================== */

function fmt(d: Date | string) {
  const dt = new Date(d);

  return `${dt.getFullYear()}-${String(
    dt.getMonth() + 1
  ).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function diffDaysInclusive(startDate: Date, endDate: Date) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  return (
    Math.floor(
      (end.getTime() - start.getTime()) / 86400000
    ) + 1
  );
}

function emailSignature() {
  return `
    <hr style="
      border:none;
      border-top:1px solid #eee;
      margin:18px 0;
    " />

    <p style="margin:0;font-size:13px;color:#555;">
      Pozdrawiamy,<br/>
      <strong>Zespół MojaSzafa</strong>
    </p>

    <p style="margin-top:6px;font-size:11px;color:#888;">
      Ta wiadomość została wysłana automatycznie —
      prosimy na nią nie odpowiadać.
    </p>
  `;
}

/* ============================================
   CREAR RESERVA
=============================================== */

export async function createBookingAction(input: {
  listingId: string;
  startDate: string;
  endDate: string;
}) {
  const session = (await getServerSession(
    authConfig
  )) as Session | null;

  const renterId = session?.user?.id;

  if (!renterId) {
    throw new Error("No autenticado");
  }

  const listing = await prisma.listing.findUnique({
    where: {
      id: input.listingId,
    },
    include: {
      user: true,
    },
  });

  if (!listing) {
    throw new Error("Anuncio no encontrado");
  }

  if (listing.userId === renterId) {
    throw new Error("No puedes reservar tu propio artículo");
  }

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    throw new Error("Fechas inválidas.");
  }

  if (end <= start) {
    throw new Error(
      "La fecha de fin debe ser posterior a la fecha de inicio."
    );
  }

  const overlapping = await prisma.booking.findFirst({
    where: {
      listingId: input.listingId,
      status: {
        in: ["PENDING", "CONFIRMED", "PAID"],
      },
      startDate: {
        lte: end,
      },
      endDate: {
        gte: start,
      },
    },
  });

  if (overlapping) {
    throw new Error("Estas fechas ya están reservadas.");
  }

  /* ============================================
     SNAPSHOT ECONÓMICO

     Se congela aquí, en el momento en que el
     usuario crea la solicitud de reserva.

     Cambios posteriores en Listing.pricePerDay
     o Listing.fianza NO modificarán esta reserva.
  =============================================== */

  const days = diffDaysInclusive(start, end);

  const pricePerDay = listing.pricePerDay;
  const deposit = listing.fianza ?? 0;

  if (!pricePerDay || pricePerDay <= 0) {
    throw new Error(
      "El anuncio no tiene un precio por día válido."
    );
  }

  if (deposit < 0) {
    throw new Error(
      "El anuncio no tiene una fianza válida."
    );
  }

  const pricePerDayCents = pricePerDay * 100;

  const rentAmountCents =
    days * pricePerDayCents;

  const depositCents =
    deposit * 100;

  const platformFeeCents = Math.round(
    (rentAmountCents * PLATFORM_FEE_RATE) / 10_000
  );

  const ownerPayoutCents =
    rentAmountCents - platformFeeCents;

  const booking = await prisma.booking.create({
    data: {
      listingId: input.listingId,
      renterId,
      ownerId: listing.userId,

      startDate: start,
      endDate: end,

      status: "PENDING",

      // Snapshot económico
      pricePerDayCents,
      rentAmountCents,
      platformFeeRate: PLATFORM_FEE_RATE,
      platformFeeCents,
      ownerPayoutCents,
      depositCents,
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

  const ref = `#${booking.bookingNumber}`;

  await prisma.conversation.updateMany({
    where: {
      listingId: booking.listingId,
      buyerId: booking.renterId,
      status: "CLOSED",
    },
    data: {
      status: "OPEN",
      closedAt: null,
      closedReason: null,
    },
  });

  const startFormatted = fmt(start);
  const endFormatted = fmt(end);
  const title = listing.title ?? "twój przedmiot";

  /* EMAIL AL PROPIETARIO */

  if (booking.listing.user?.email) {
    await sendMail({
      to: booking.listing.user.email,
      subject: `Nowa prośba o rezerwację ${ref}: ${title}`,
      html: `
        <p>
          Cześć ${booking.listing.user.name ?? ""},
        </p>

        <p>
          <strong>Numer rezerwacji:</strong>
          ${ref}
        </p>

        <p>
          ${booking.renter?.name ?? "Użytkownik"}
          chce dokonać rezerwacji
          <strong>${title}</strong>.
        </p>

        <p>
          Daty:
          <strong>
            ${startFormatted} → ${endFormatted}
          </strong>
        </p>

        <p>
          Możesz zaakceptować lub odrzucić rezerwację
          w swoim panelu.
        </p>

        ${emailSignature()}
      `,
    });
  }

  /* EMAIL AL INQUILINO */

  if (booking.renter?.email) {
    await sendMail({
      to: booking.renter.email,
      subject: `Wniosek ${ref} wysłany na ${title}`,
      html: `
        <p>
          Cześć ${booking.renter.name ?? ""},
        </p>

        <p>
          <strong>Numer rezerwacji:</strong>
          ${ref}
        </p>

        <p>
          Twoje zgłoszenie dotyczące
          <strong>${title}</strong>
          (${startFormatted} → ${endFormatted})
          zostało wysłane do właściciela.
        </p>

        <p>
          Poinformujemy Cię, gdy właściciel je zatwierdzi.
        </p>

        ${emailSignature()}
      `,
    });
  }

  revalidatePath("/bookings");
  revalidatePath(`/listing/${listing.id}`);

  return {
    bookingId: booking.id,
    status: booking.status,
  };
}

/* ============================================
   APROBAR RESERVA
=============================================== */

export async function approveBookingAction(
  bookingId: string
) {
  const session = (await getServerSession(
    authConfig
  )) as Session | null;

  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("No autenticado");
  }

  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
    include: {
      listing: {
        include: {
          user: true,
        },
      },
      renter: true,
    },
  });

  if (!booking) {
    throw new Error("Reserva no encontrada");
  }

  if (booking.listing.userId !== userId) {
    throw new Error("No autorizado");
  }

  if (booking.status !== "PENDING") {
    throw new Error("Esta reserva ya fue procesada");
  }

  const ref = `#${booking.bookingNumber}`;

  /* ============================================
     ECONOMÍA DE LA RESERVA

     Reservas nuevas:
     usamos SIEMPRE el snapshot guardado.

     Reservas históricas:
     si los nuevos campos son NULL, calculamos
     temporalmente desde Listing.
  =============================================== */

  const days = diffDaysInclusive(
    booking.startDate,
    booking.endDate
  );

  const fallbackPricePerDayCents =
    booking.listing.pricePerDay * 100;

  const fallbackDepositCents =
    (booking.listing.fianza ?? 0) * 100;

  const pricePerDayCents =
    booking.pricePerDayCents ??
    fallbackPricePerDayCents;

  const rentAmountCents =
    booking.rentAmountCents ??
    days * pricePerDayCents;

  const depositCents =
    booking.depositCents ??
    fallbackDepositCents;

  const platformFeeRate =
    booking.platformFeeRate ??
    PLATFORM_FEE_RATE;

  const platformFeeCents =
    booking.platformFeeCents ??
    Math.round(
      (rentAmountCents * platformFeeRate) / 10_000
    );

  const ownerPayoutCents =
    booking.ownerPayoutCents ??
    rentAmountCents - platformFeeCents;

  if (pricePerDayCents <= 0) {
    throw new Error(
      "La reserva no tiene un precio por día válido."
    );
  }

  if (depositCents < 0) {
    throw new Error(
      "La reserva no tiene una fianza válida."
    );
  }

  const totalCents =
    rentAmountCents + depositCents;

  const moneyPLNFromCents = (value: number) =>
    `${new Intl.NumberFormat("pl-PL").format(
      value / 100
    )} zł`;

  /*
   * Para reservas históricas también persistimos
   * el snapshot calculado en el momento de aprobar.
   *
   * Para reservas nuevas estos valores ya existirán
   * y simplemente se conservarán.
   */

  await prisma.booking.update({
    where: {
      id: bookingId,
    },
    data: {
      status: "AWAITING_PAYMENT",
      paymentStatus: "PENDING",

      paymentDueAt: new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ),

      cancelledAt: null,

      // Campo legacy que sigue utilizando
      // actualmente parte del flujo de pago.
      amountCents: rentAmountCents,

      // Snapshot económico
      pricePerDayCents,
      rentAmountCents,
      platformFeeRate,
      platformFeeCents,
      ownerPayoutCents,
      depositCents,
    },
  });

  await prisma.conversation.updateMany({
    where: {
      listingId: booking.listingId,
      buyerId: booking.renterId,
      status: "CLOSED",
    },
    data: {
      status: "OPEN",
      closedAt: null,
      closedReason: null,
    },
  });

  const title =
    booking.listing.title ?? "twój przedmiot";

  const startFormatted = fmt(booking.startDate);
  const endFormatted = fmt(booking.endDate);

  /* EMAIL AL INQUILINO */

  if (booking.renter?.email) {
    await sendMail({
      to: booking.renter.email,
      subject: `Rezerwacja potwierdzona ${ref}: ${title}`,
      html: `
        <div style="
          font-family:Arial,Helvetica,sans-serif;
          font-size:14px;
          color:#111;
          line-height:1.5;
        ">
          <p>
            Cześć ${booking.renter.name ?? ""},
          </p>

          <p>
            Twoja rezerwacja została
            <strong>zatwierdzona przez właściciela</strong>.
          </p>

          <div style="
            margin:16px 0;
            padding:16px;
            border:1px solid #e5e7eb;
            border-radius:8px;
            background:#fafafa;
          ">
            <p style="
              margin:0 0 8px;
              font-size:16px;
              font-weight:600;
            ">
              ${booking.listing.title}
            </p>

            <p style="margin:4px 0;">
              <strong>Numer rezerwacji:</strong>
              #${booking.bookingNumber}
            </p>

            <p style="margin:4px 0;">
              <strong>Daty:</strong>
              ${startFormatted} → ${endFormatted}
            </p>

            <p style="margin:4px 0;">
              <strong>Kwota do zapłaty:</strong>
              ${moneyPLNFromCents(totalCents)}
            </p>
          </div>

          <p style="margin-top:12px;">
            Aby sfinalizować rezerwację,
            dokonaj płatności w aplikacji.
          </p>

          <p>
            <a
              href="${process.env.APP_URL}/bookings/${booking.id}/pay"
              style="
                display:inline-block;
                margin-top:12px;
                padding:12px 18px;
                background:#16a34a;
                color:white;
                text-decoration:none;
                border-radius:6px;
                font-weight:600;
              "
            >
              Opłać rezerwację
            </a>
          </p>

          <div style="
            margin-top:18px;
            padding:14px;
            background:#fef3c7;
            border:1px solid #fcd34d;
            border-radius:8px;
          ">
            <strong>Ważne:</strong><br/>

            Rezerwacja będzie ważna dopiero po
            zaksięgowaniu płatności.<br/><br/>

            ⏳ Jeśli płatność nie zostanie dokonana
            w ciągu <strong>24 godzin od zatwierdzenia</strong>,
            rezerwacja zostanie automatycznie anulowana.
            <br/><br/>

            Po potwierdzeniu płatności otrzymasz
            kolejne powiadomienie.
          </div>

          ${emailSignature()}
        </div>
      `,
    });
  }

  /* EMAIL AL PROPIETARIO */

  if (booking.listing.user?.email) {
    await sendMail({
      to: booking.listing.user.email,
      subject: `Potwierdziłeś rezerwację ${ref}: ${title}`,
      html: `
        <div style="
          font-family:Arial,Helvetica,sans-serif;
          font-size:14px;
          color:#111;
          line-height:1.5;
        ">
          <p>
            Cześć ${booking.listing.user.name ?? ""},
          </p>

          <p>
            Pomyślnie
            <strong>zatwierdziłeś rezerwację</strong>.
          </p>

          <div style="
            margin:16px 0;
            padding:16px;
            border:1px solid #e5e7eb;
            border-radius:8px;
            background:#fafafa;
          ">
            <p style="
              margin:0 0 8px;
              font-size:16px;
              font-weight:600;
            ">
              ${booking.listing.title}
            </p>

            <p style="margin:4px 0;">
              <strong>Numer rezerwacji:</strong>
              #${booking.bookingNumber}
            </p>

            <p style="margin:4px 0;">
              <strong>Klient:</strong>
              ${booking.renter?.name ?? "Użytkownik"}
            </p>

            <p style="margin:4px 0;">
              <strong>Daty:</strong>
              ${startFormatted} → ${endFormatted}
            </p>
          </div>

          <p>
            Rezerwacja oczekuje teraz na dokonanie
            płatności przez klienta.
          </p>

          <p>
            Otrzymasz osobne powiadomienie e-mail,
            gdy płatność zostanie potwierdzona.
          </p>

          <div style="
            margin-top:18px;
            padding:14px;
            background:#fee2e2;
            border:1px solid #fca5a5;
            border-radius:8px;
            color:#991b1b;
          ">
            <strong>Ważne:</strong><br/>
            Nie przekazuj przedmiotu do momentu
            potwierdzenia płatności w aplikacji.
          </div>

          <p>
            <a
              href="${process.env.APP_URL}/bookings/${booking.id}"
              style="
                display:inline-block;
                margin-top:14px;
                padding:10px 16px;
                background:#111827;
                color:white;
                text-decoration:none;
                border-radius:6px;
                font-weight:500;
              "
            >
              Zobacz szczegóły rezerwacji
            </a>
          </p>

          ${emailSignature()}
        </div>
      `,
    });
  }

  revalidatePath("/bookings");

  return {
    ok: true,
  };
}

/* ============================================
   RECHAZAR RESERVA Y CERRAR CHAT
=============================================== */

export async function rejectBookingAction(
  bookingId: string
) {
  const session = (await getServerSession(
    authConfig
  )) as Session | null;

  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("No autenticado");
  }

  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
    include: {
      listing: {
        include: {
          user: true,
        },
      },
      renter: true,
    },
  });

  if (!booking) {
    throw new Error("Reserva no encontrada");
  }

  if (booking.listing.userId !== userId) {
    throw new Error("No autorizado");
  }

  if (booking.status !== "PENDING") {
    throw new Error(
      "Solo reservas pendientes pueden rechazarse"
    );
  }

  const ref = `#${booking.bookingNumber}`;

  await prisma.booking.update({
    where: {
      id: bookingId,
    },
    data: {
      status: "CANCELLED",
    },
  });

  const stillActive = await prisma.booking.findFirst({
    where: {
      listingId: booking.listingId,
      renterId: booking.renterId,
      status: {
        in: [
          "PENDING",
          "CONFIRMED",
          "AWAITING_PAYMENT",
          "PAID",
        ],
      },
    },
    select: {
      id: true,
    },
  });

  const conversation =
    await prisma.conversation.findUnique({
      where: {
        listingId_buyerId: {
          listingId: booking.listingId,
          buyerId: booking.renterId,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

  if (conversation && !stillActive) {
    await prisma.conversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedReason: "BOOKING_CANCELLED_BY_OWNER",
      },
    });

    revalidatePath(`/chat/${conversation.id}`);
  }

  const title =
    booking.listing.title ?? "twój przedmiot";

  const startFormatted = fmt(booking.startDate);
  const endFormatted = fmt(booking.endDate);

  /* EMAIL AL INQUILINO */

  if (booking.renter?.email) {
    await sendMail({
      to: booking.renter.email,
      subject: `Rezerwacja odrzucona ${ref}: ${title}`,
      html: `
        <div style="
          font-family:Arial,Helvetica,sans-serif;
          font-size:14px;
          color:#111;
          line-height:1.5;
        ">
          <p>
            Cześć ${booking.renter.name ?? ""},
          </p>

          <p>
            Niestety właściciel odrzucił Twoją rezerwację.
          </p>

          <div style="
            margin:16px 0;
            padding:16px;
            border:1px solid #e5e7eb;
            border-radius:8px;
            background:#fafafa;
          ">
            <p style="
              margin:0 0 8px;
              font-size:16px;
              font-weight:600;
            ">
              ${booking.listing.title}
            </p>

            <p style="margin:4px 0;">
              <strong>Numer rezerwacji:</strong>
              #${booking.bookingNumber}
            </p>

            <p style="margin:4px 0;">
              <strong>Daty:</strong>
              ${startFormatted} → ${endFormatted}
            </p>
          </div>

          <div style="
            margin-top:14px;
            padding:14px;
            background:#f3f4f6;
            border-radius:8px;
          ">
            Możesz spróbować wybrać inne daty
            lub znaleźć podobny przedmiot dostępny
            w tym terminie.
          </div>

          <p>
            <a
              href="${process.env.APP_URL}/listing/${booking.listing.id}"
              style="
                display:inline-block;
                margin-top:14px;
                padding:10px 16px;
                background:#111827;
                color:white;
                text-decoration:none;
                border-radius:6px;
                font-weight:500;
              "
            >
              Zobacz ogłoszenie
            </a>
          </p>

          ${emailSignature()}
        </div>
      `,
    });
  }

  /* EMAIL AL PROPIETARIO */

  if (booking.listing.user?.email) {
    await sendMail({
      to: booking.listing.user.email,
      subject: `Odrzuciłeś rezerwację ${ref}: ${title}`,
      html: `
        <div style="
          font-family:Arial,Helvetica,sans-serif;
          font-size:14px;
          color:#111;
          line-height:1.5;
        ">
          <p>
            Cześć ${booking.listing.user.name ?? ""},
          </p>

          <p>
            Pomyślnie
            <strong>odrzuciłeś rezerwację</strong>.
          </p>

          <div style="
            margin:16px 0;
            padding:16px;
            border:1px solid #e5e7eb;
            border-radius:8px;
            background:#fafafa;
          ">
            <p style="
              margin:0 0 8px;
              font-size:16px;
              font-weight:600;
            ">
              ${booking.listing.title}
            </p>

            <p style="margin:4px 0;">
              <strong>Numer rezerwacji:</strong>
              #${booking.bookingNumber}
            </p>

            <p style="margin:4px 0;">
              <strong>Klient:</strong>
              ${booking.renter?.name ?? "Użytkownik"}
            </p>

            <p style="margin:4px 0;">
              <strong>Daty:</strong>
              ${startFormatted} → ${endFormatted}
            </p>
          </div>

          <div style="
            margin-top:14px;
            padding:14px;
            border:1px solid #fca5a5;
            border-radius:8px;
            background:#fee2e2;
            color:#991b1b;
          ">
            <strong>Rezerwacja została anulowana.</strong>
            <br/>
            Te terminy mogą być ponownie dostępne
            dla innych klientów.
          </div>

          <p>
            <a
              href="${process.env.APP_URL}/listing/${booking.listing.id}"
              style="
                display:inline-block;
                margin-top:14px;
                padding:10px 16px;
                background:#111827;
                color:white;
                text-decoration:none;
                border-radius:6px;
                font-weight:500;
              "
            >
              Zobacz ogłoszenie
            </a>
          </p>

          ${emailSignature()}
        </div>
      `,
    });
  }

  revalidatePath("/bookings");
  revalidatePath("/chat");

  return {
    ok: true,
    closedChat: Boolean(conversation),
  };
}

/* ============================================
   STRIPE CHECKOUT (DESACTIVADO)
=============================================== */

/*
export async function createCheckoutSessionAction(
  bookingId: string
) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("No autorizado");
  }

  // Aquí iría el código de Stripe.

  return {
    bookingId,
  };
}
*/