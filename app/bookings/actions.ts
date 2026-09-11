"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/app/lib/mailer";
import { PAYMENT_WINDOW_MS } from "@/app/lib/paymentExpiry";

// 1500 basis points = 15 %
const PLATFORM_FEE_RATE = 1500;

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

  return Math.floor(
    (end.getTime() - start.getTime()) / 86400000
  ) + 1;
}

function baseUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return replacements[char];
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
      Ta wiadomość została wysłana automatycznie —
      prosimy na nią nie odpowiadać.
    </p>
  `;
}

/* ============================================
   CREAR RESERVA
============================================ */

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

  // Permite que inicio y fin sean el mismo día.
  if (end < start) {
    throw new Error(
      "La fecha de fin no puede ser anterior a la fecha de inicio."
    );
  }

  const overlapping = await prisma.booking.findFirst({
    where: {
      listingId: input.listingId,
      status: {
        in: [
          "PENDING",
          "AWAITING_PAYMENT",
          "CONFIRMED",
          "PAID",
        ],
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

  // Los importes quedan guardados en la reserva.
  const days = diffDaysInclusive(start, end);
  const pricePerDay = listing.pricePerDay;
  const deposit = listing.fianza ?? 0;

  if (!pricePerDay || pricePerDay <= 0) {
    throw new Error(
      "El anuncio no tiene un precio por día válido."
    );
  }

  if (deposit < 0) {
    throw new Error("El anuncio no tiene una fianza válida.");
  }

  const pricePerDayCents = Math.round(pricePerDay * 100);
  const rentAmountCents = days * pricePerDayCents;
  const depositCents = Math.round(deposit * 100);

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

  const ref = `#${booking.bookingNumber}`;
  const title = listing.title ?? "twój przedmiot";
  const safeTitle = escapeHtml(title);
  const startFormatted = fmt(start);
  const endFormatted = fmt(end);

  if (booking.listing.user?.email) {
    await sendMail({
      to: booking.listing.user.email,
      subject: `Nowa prośba o rezerwację ${ref}: ${title}`,
      html: `
        <p>Cześć ${escapeHtml(
          booking.listing.user.name ?? ""
        )},</p>

        <p><strong>Numer rezerwacji:</strong> ${ref}</p>

        <p>
          ${escapeHtml(booking.renter?.name ?? "Użytkownik")}
          chce dokonać rezerwacji
          <strong>${safeTitle}</strong>.
        </p>

        <p>
          Daty:
          <strong>${startFormatted} → ${endFormatted}</strong>
        </p>

        <p>
          Możesz zaakceptować lub odrzucić rezerwację
          w swoim panelu.
        </p>

        ${emailSignature()}
      `,
    });
  }

  if (booking.renter?.email) {
    await sendMail({
      to: booking.renter.email,
      subject: `Wniosek ${ref} wysłany na ${title}`,
      html: `
        <p>Cześć ${escapeHtml(booking.renter.name ?? "")},</p>

        <p><strong>Numer rezerwacji:</strong> ${ref}</p>

        <p>
          Twoje zgłoszenie dotyczące
          <strong>${safeTitle}</strong>
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
   ACEPTAR RESERVA
============================================ */

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

  const days = diffDaysInclusive(
    booking.startDate,
    booking.endDate
  );

  // Conserva los importes guardados. El fallback mantiene
  // compatibilidad con solicitudes antiguas sin snapshot.
  const pricePerDayCents =
    booking.pricePerDayCents ??
    Math.round(booking.listing.pricePerDay * 100);

  const rentAmountCents =
    booking.rentAmountCents ?? days * pricePerDayCents;

  const depositCents =
    booking.depositCents ??
    Math.round((booking.listing.fianza ?? 0) * 100);

  const platformFeeRate =
    booking.platformFeeRate ?? PLATFORM_FEE_RATE;

  const platformFeeCents =
    booking.platformFeeCents ??
    Math.round(
      (rentAmountCents * platformFeeRate) / 10_000
    );

  const ownerPayoutCents =
    booking.ownerPayoutCents ??
    rentAmountCents - platformFeeCents;

  if (pricePerDayCents <= 0 || rentAmountCents <= 0) {
    throw new Error(
      "La reserva no tiene un importe de alquiler válido."
    );
  }

  if (depositCents < 0) {
    throw new Error("La reserva no tiene una fianza válida.");
  }

  // El plazo empieza ahora, al aceptar la solicitud.
  const paymentDueAt = new Date(
    Date.now() + PAYMENT_WINDOW_MS
  );

  // La condición PENDING evita aceptar dos veces
  // o reiniciar el plazo mediante peticiones simultáneas.
  const approved = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: "PENDING",
    },
    data: {
      status: "AWAITING_PAYMENT",
      paymentStatus: "PENDING",
      paymentDueAt,
      cancelledAt: null,
      amountCents: rentAmountCents,
      pricePerDayCents,
      rentAmountCents,
      platformFeeRate,
      platformFeeCents,
      ownerPayoutCents,
      depositCents,
    },
  });

  if (approved.count !== 1) {
    throw new Error(
      "Ta rezerwacja została już przetworzona."
    );
  }

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

  const ref = `#${booking.bookingNumber}`;
  const title = booking.listing.title ?? "twój przedmiot";
  const safeTitle = escapeHtml(title);
  const startFormatted = fmt(booking.startDate);
  const endFormatted = fmt(booking.endDate);
  const totalCents = rentAmountCents + depositCents;

  const totalFormatted =
    `${new Intl.NumberFormat("pl-PL").format(
      totalCents / 100
    )} zł`;

  const deadlineFormatted = new Intl.DateTimeFormat(
    "pl-PL",
    {
      timeZone: "Europe/Warsaw",
      dateStyle: "short",
      timeStyle: "short",
    }
  ).format(paymentDueAt);

  const bookingUrl =
    `${baseUrl()}/bookings/${booking.id}`;

  if (booking.renter?.email) {
    await sendMail({
      to: booking.renter.email,
      subject: `Rezerwacja potwierdzona ${ref}: ${title}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5;">
          <p>Cześć ${escapeHtml(
            booking.renter.name ?? ""
          )},</p>

          <p>
            Twoja rezerwacja została
            <strong>zatwierdzona przez właściciela</strong>.
          </p>

          <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;">
            <p style="margin:0 0 8px;font-size:16px;font-weight:600;">
              ${safeTitle}
            </p>

            <p><strong>Numer rezerwacji:</strong> ${ref}</p>

            <p>
              <strong>Daty:</strong>
              ${startFormatted} → ${endFormatted}
            </p>

            <p>
              <strong>Kwota do zapłaty:</strong>
              ${totalFormatted}
            </p>
          </div>

          <p>
            Aby sfinalizować rezerwację,
            dokonaj płatności w aplikacji.
          </p>

          <p>
            <a
              href="${escapeHtml(bookingUrl + "/pay")}"
              style="display:inline-block;margin-top:12px;padding:12px 18px;background:#16a34a;color:white;text-decoration:none;border-radius:6px;font-weight:600;"
            >
              Opłać rezerwację
            </a>
          </p>

          <div style="margin-top:18px;padding:14px;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;">
            <strong>Ważne:</strong><br/>

            Na opłacenie rezerwacji masz
            <strong>2 godziny od zatwierdzenia</strong>.
            <br/><br/>

            <strong>Termin płatności:</strong>
            ${deadlineFormatted} (czas polski).
            <br/><br/>

            Jeśli płatność nie zostanie dokonana w terminie,
            rezerwacja zostanie anulowana.
            <br/><br/>

            Po potwierdzeniu płatności otrzymasz
            kolejne powiadomienie.
          </div>

          ${emailSignature()}
        </div>
      `,
    });
  }

  if (booking.listing.user?.email) {
    await sendMail({
      to: booking.listing.user.email,
      subject: `Potwierdziłeś rezerwację ${ref}: ${title}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5;">
          <p>Cześć ${escapeHtml(
            booking.listing.user.name ?? ""
          )},</p>

          <p>
            Pomyślnie
            <strong>zatwierdziłeś rezerwację</strong>.
          </p>

          <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;">
            <p style="margin:0 0 8px;font-size:16px;font-weight:600;">
              ${safeTitle}
            </p>

            <p><strong>Numer rezerwacji:</strong> ${ref}</p>

            <p>
              <strong>Klient:</strong>
              ${escapeHtml(
                booking.renter?.name ?? "Użytkownik"
              )}
            </p>

            <p>
              <strong>Daty:</strong>
              ${startFormatted} → ${endFormatted}
            </p>
          </div>

          <p>
            Rezerwacja oczekuje teraz na dokonanie
            płatności przez klienta.
          </p>

          <p>
            Termin płatności:
            <strong>${deadlineFormatted}</strong>
            (czas polski).
          </p>

          <p>
            Otrzymasz osobne powiadomienie e-mail,
            gdy płatność zostanie potwierdzona.
          </p>

          <div style="margin-top:18px;padding:14px;background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;color:#991b1b;">
            <strong>Ważne:</strong><br/>
            Nie przekazuj przedmiotu do momentu
            potwierdzenia płatności w aplikacji.
          </div>

          <p>
            <a
              href="${escapeHtml(bookingUrl)}"
              style="display:inline-block;margin-top:14px;padding:10px 16px;background:#111827;color:white;text-decoration:none;border-radius:6px;"
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
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/listing/${booking.listingId}`);

  return {
    ok: true,
  };
}

/* ============================================
   RECHAZAR RESERVA Y CERRAR CHAT
============================================ */

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

  // Evita rechazar una reserva que acaba de ser aceptada.
  const rejected = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });

  if (rejected.count !== 1) {
    throw new Error(
      "Ta rezerwacja została już przetworzona."
    );
  }

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

  const conversation = await prisma.conversation.findUnique({
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

  let closedChat = false;

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

    closedChat = true;
    revalidatePath(`/chat/${conversation.id}`);
  }

  const ref = `#${booking.bookingNumber}`;
  const title = booking.listing.title ?? "twój przedmiot";
  const safeTitle = escapeHtml(title);
  const startFormatted = fmt(booking.startDate);
  const endFormatted = fmt(booking.endDate);

  const listingUrl =
    `${baseUrl()}/listing/${booking.listingId}`;

  if (booking.renter?.email) {
    await sendMail({
      to: booking.renter.email,
      subject: `Rezerwacja odrzucona ${ref}: ${title}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5;">
          <p>Cześć ${escapeHtml(
            booking.renter.name ?? ""
          )},</p>

          <p>
            Niestety właściciel odrzucił Twoją rezerwację.
          </p>

          <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;">
            <p><strong>${safeTitle}</strong></p>
            <p><strong>Numer rezerwacji:</strong> ${ref}</p>

            <p>
              <strong>Daty:</strong>
              ${startFormatted} → ${endFormatted}
            </p>
          </div>

          <p>
            Możesz spróbować wybrać inne daty
            lub znaleźć podobny przedmiot dostępny
            w tym terminie.
          </p>

          <p>
            <a href="${escapeHtml(listingUrl)}">
              Zobacz ogłoszenie
            </a>
          </p>

          ${emailSignature()}
        </div>
      `,
    });
  }

  if (booking.listing.user?.email) {
    await sendMail({
      to: booking.listing.user.email,
      subject: `Odrzuciłeś rezerwację ${ref}: ${title}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5;">
          <p>Cześć ${escapeHtml(
            booking.listing.user.name ?? ""
          )},</p>

          <p>
            Pomyślnie
            <strong>odrzuciłeś rezerwację</strong>.
          </p>

          <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;">
            <p><strong>${safeTitle}</strong></p>
            <p><strong>Numer rezerwacji:</strong> ${ref}</p>

            <p>
              <strong>Klient:</strong>
              ${escapeHtml(
                booking.renter?.name ?? "Użytkownik"
              )}
            </p>

            <p>
              <strong>Daty:</strong>
              ${startFormatted} → ${endFormatted}
            </p>
          </div>

          <p>
            <strong>Rezerwacja została anulowana.</strong>
            Te terminy mogą być ponownie dostępne
            dla innych klientów.
          </p>

          <p>
            <a href="${escapeHtml(listingUrl)}">
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
  revalidatePath(`/listing/${booking.listingId}`);

  return {
    ok: true,
    closedChat,
  };
}