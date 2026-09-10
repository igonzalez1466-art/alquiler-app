"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/app/lib/mailer";

/* ============================================================
   CONFIGURACIÓN ECONÓMICA
============================================================ */

// Basis points:
// 1500 = 15.00%
const PLATFORM_FEE_RATE = 1500;

/* ============================================================
   HELPERS
============================================================ */

// Días de alquiler, incluyendo día inicial y final
function diffDaysInclusive(a: Date, b: Date) {
  const start = new Date(
    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  );

  const end = new Date(
    Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  );

  return (
    Math.floor(
      (end.getTime() - start.getTime()) / 86_400_000
    ) + 1
  );
}

// Pluralización polaca
function pluralPLDay(n: number) {
  return n === 1 ? "dzień" : "dni";
}

// Base URL estable para emails
function getEmailBaseUrl(): string {
  const raw =
    process.env.APP_URL || "http://localhost:3000";

  return raw.endsWith("/")
    ? raw.slice(0, -1)
    : raw;
}

// Firma fija
function emailSignature() {
  return `
    <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />

    <p style="margin:0; font-size:13px; color:#555;">
      Pozdrawiamy,<br/>
      <strong>Zespół MojaSzafa</strong>
    </p>

    <p style="margin-top:6px; font-size:11px; color:#888;">
      Ta wiadomość została wysłana automatycznie —
      prosimy na nią nie odpowiadać.
    </p>
  `;
}

/* ============================================================
   START CHAT
============================================================ */

export async function startChatAction(formData: FormData) {
  const session = (await getServerSession(
    authConfig
  )) as Session | null;

  const currentUserId = session?.user?.id;

  if (!currentUserId) {
    redirect("/login");
  }

  const listingId =
    formData.get("listingId")?.toString();

  const ownerId =
    formData.get("ownerId")?.toString();

  if (!listingId || !ownerId) {
    throw new Error("Datos incompletos");
  }

  if (currentUserId === ownerId) {
    redirect("/");
  }

  const existing =
    await prisma.conversation.findUnique({
      where: {
        listingId_buyerId: {
          listingId,
          buyerId: currentUserId,
        },
      },

      select: {
        id: true,
      },
    });

  if (existing) {
    // Si estaba cerrada, la reabrimos
    await prisma.conversation.updateMany({
      where: {
        id: existing.id,
        status: "CLOSED",
      },

      data: {
        status: "OPEN",
        closedAt: null,
        closedReason: null,
      },
    });

    redirect(`/chat/${existing.id}`);
  }

  const created =
    await prisma.conversation.create({
      data: {
        listingId,
        buyerId: currentUserId,
        sellerId: ownerId,
        status: "OPEN",
      },

      select: {
        id: true,
      },
    });

  redirect(`/chat/${created.id}`);
}

/* ============================================================
   CREATE BOOKING + EMAILS
============================================================ */

export async function createBookingAction(
  formData: FormData
) {
  const session = (await getServerSession(
    authConfig
  )) as Session | null;

  const renterId = session?.user?.id;

  if (!renterId) {
    redirect("/login");
  }

  /* ==========================================================
     FORM DATA
  ========================================================== */

  const listingId =
    formData.get("listingId")?.toString();

  const startStr =
    formData.get("startDate")?.toString();

  const endStr =
    formData.get("endDate")?.toString();

  if (!listingId || !startStr || !endStr) {
    redirect(
      `/listing/${listingId ?? ""}?error=datos-incompletos`
    );
  }

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  if (
    isNaN(startDate.getTime()) ||
    isNaN(endDate.getTime())
  ) {
    redirect(
      `/listing/${listingId}?error=fechas-invalidas`
    );
  }

  if (endDate < startDate) {
    redirect(
      `/listing/${listingId}?error=fin-no-posterior`
    );
  }

  /* ==========================================================
     LISTING
  ========================================================== */

  const listing =
    await prisma.listing.findUnique({
      where: {
        id: listingId,
      },

      select: {
        id: true,
        title: true,
        pricePerDay: true,
        fianza: true,
        userId: true,
        available: true,

        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

  if (!listing) {
    redirect(
      `/listing/${listingId}?error=anuncio-no-encontrado`
    );
  }

  if (listing.userId === renterId) {
    redirect(
      `/listing/${listingId}?error=no-propio`
    );
  }

  if (listing.available === false) {
    redirect(
      `/listing/${listingId}?error=anuncio-no-disponible`
    );
  }

  /* ==========================================================
     SNAPSHOT ECONÓMICO

     Se calcula ANTES de crear Booking.

     A partir de este momento, los cambios posteriores
     en Listing.pricePerDay o Listing.fianza no deben
     modificar la economía de esta reserva.
  ========================================================== */

  const days =
    diffDaysInclusive(
      startDate,
      endDate
    );

  if (days <= 0) {
    redirect(
      `/listing/${listingId}?error=fechas-invalidas`
    );
  }

  if (
    !listing.pricePerDay ||
    listing.pricePerDay <= 0
  ) {
    redirect(
      `/listing/${listingId}?error=precio-invalido`
    );
  }

  if (
    listing.fianza !== null &&
    listing.fianza < 0
  ) {
    redirect(
      `/listing/${listingId}?error=fianza-invalida`
    );
  }

  // Precio diario congelado
  const pricePerDayCents =
    listing.pricePerDay * 100;

  // Alquiler completo
  const rentAmountCents =
    days * pricePerDayCents;

  // Fianza: NO está sujeta a comisión
  const depositCents =
    (listing.fianza ?? 0) * 100;

  // Comisión MojaSzafa: 15% del alquiler
  const platformFeeCents =
    Math.round(
      (rentAmountCents * PLATFORM_FEE_RATE) /
        10_000
    );

  // Importe del alquiler correspondiente al owner
  const ownerPayoutCents =
    rentAmountCents - platformFeeCents;

  /* ==========================================================
     CREATE BOOKING
  ========================================================== */

  const booking =
    await prisma.$transaction(async (tx) => {
      const overlap =
        await tx.booking.findFirst({
          where: {
            listingId,

            status: {
              in: [
                "PENDING",
                "CONFIRMED",
                "PAID",
              ],
            },

            AND: [
              {
                startDate: {
                  lte: endDate,
                },
              },
              {
                endDate: {
                  gte: startDate,
                },
              },
            ],
          },

          select: {
            id: true,
          },
        });

      if (overlap) {
        redirect(
          `/listing/${listingId}?error=fechas-no-disponibles`
        );
      }

      const newBooking =
        await tx.booking.create({
          data: {
            listingId,
            renterId,

            // Snapshot del owner
            ownerId: listing.userId,

            startDate,
            endDate,

            status: "PENDING",

            // Snapshot económico
            pricePerDayCents,
            rentAmountCents,
            platformFeeRate: PLATFORM_FEE_RATE,
            platformFeeCents,
            ownerPayoutCents,
            depositCents,
          },

          select: {
            id: true,
            bookingNumber: true,
            startDate: true,
            endDate: true,
            status: true,

            // Snapshot económico
            pricePerDayCents: true,
            rentAmountCents: true,
            platformFeeRate: true,
            platformFeeCents: true,
            ownerPayoutCents: true,
            depositCents: true,
          },
        });

      // Reabrir o crear conversación
      await tx.conversation.upsert({
        where: {
          listingId_buyerId: {
            listingId,
            buyerId: renterId,
          },
        },

        update: {
          status: "OPEN",
          closedAt: null,
          closedReason: null,
        },

        create: {
          listingId,
          buyerId: renterId,
          sellerId: listing.userId,
          status: "OPEN",
        },
      });

      return newBooking;
    });

  /* ==========================================================
     RENTER
  ========================================================== */

  const renter =
    await prisma.user.findUnique({
      where: {
        id: renterId,
      },

      select: {
        email: true,
        name: true,
      },
    });

  /* ==========================================================
     IMPORTES PARA EMAIL

     Usamos el mismo snapshot económico.
     No volvemos a calcular desde Listing.
  ========================================================== */

  const alquiler =
    rentAmountCents / 100;

  const fianza =
    depositCents / 100;

  // Total que pagará el renter
  const total =
    (rentAmountCents + depositCents) / 100;

  // 1500 basis points -> 15
  const platformFeePercent =
    PLATFORM_FEE_RATE / 100;

  const platformFee =
    platformFeeCents / 100;

  const ownerEarnings =
    ownerPayoutCents / 100;

  /* ==========================================================
     FORMATTERS
  ========================================================== */

  const d = (x: Date) =>
    x.toLocaleDateString(
      "pl-PL",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );

  const moneyPLN = (v: number) =>
    `${new Intl.NumberFormat(
      "pl-PL"
    ).format(v)} zł`;

  const baseUrl =
    getEmailBaseUrl();

  const ref =
    `#${booking.bookingNumber}`;

  const ownerTo =
    listing.user?.email?.trim() || "";

  const renterTo =
    renter?.email?.trim() || "";

  // URL directa al detalle de ESTA reserva
  const bookingUrl =
    `${baseUrl}/bookings/${booking.id}`;

  /* ==========================================================
     EMAILS
  ========================================================== */

  await Promise.allSettled([

    /* ========================================================
       OWNER EMAIL
    ======================================================== */

    ownerTo
      ? sendMail({
          to: ownerTo,

          subject:
            `Nowa prośba o rezerwację ${ref}: ${listing.title}`,

          html: `
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#111; line-height:1.5;">

  <p>
    Cześć ${listing.user?.name ?? ""},
  </p>

  <p>
    Otrzymałeś nową prośbę o rezerwację.
  </p>

  <div
    style="
      margin:16px 0;
      padding:16px;
      border:1px solid #e5e7eb;
      border-radius:8px;
      background:#fafafa;
    "
  >

    <p
      style="
        margin:0 0 8px 0;
        font-size:16px;
        font-weight:600;
      "
    >
      ${listing.title}
    </p>

    <p style="margin:4px 0;">
      <strong>Numer rezerwacji:</strong>
      ${ref}
    </p>

    <p style="margin:4px 0;">
      <strong>Daty:</strong>
      ${d(startDate)} → ${d(endDate)}
      (${days} ${pluralPLDay(days)})
    </p>

    <!-- ALQUILER -->

    <p style="margin:4px 0;">
      <strong>Koszt najmu:</strong>
      ${moneyPLN(alquiler)}
    </p>

    <!-- COMISIÓN - SOLO OWNER -->

    <p style="margin:4px 0;">
      <strong>
        Prowizja MojaSzafa (${platformFeePercent}%):
      </strong>

      −${moneyPLN(platformFee)}
    </p>

    <!-- NETO OWNER -->

    <p
      style="
        margin:8px 0 4px 0;
        padding-top:8px;
        border-top:1px solid #e5e7eb;
      "
    >
      <strong>
        Twoje wynagrodzenie:
      </strong>

      <span
        style="
          font-weight:700;
          color:#047857;
          font-size:15px;
        "
      >
        ${moneyPLN(ownerEarnings)}
      </span>
    </p>

    ${
      fianza > 0
        ? `
          <p style="margin:8px 0 4px 0;">
            <strong>Kaucja (zwrotna):</strong>
            ${moneyPLN(fianza)}
          </p>
        `
        : ""
    }

    <p
      style="
        margin:8px 0 4px 0;
        font-size:12px;
        color:#6b7280;
      "
    >
      Prowizja MojaSzafa jest naliczana wyłącznie
      od kosztu najmu. Kaucja nie jest objęta prowizją.
    </p>

    <p style="margin:10px 0 4px 0;">
      <strong>Klient:</strong>
      ${renter?.name ?? "Użytkownik"}
    </p>

  </div>

  <p style="margin-top:12px;">
    Status rezerwacji:
    <strong>Oczekuje na Twoją decyzję</strong>
  </p>

  <p>
    Zaloguj się do panelu i zdecyduj,
    czy chcesz zaakceptować lub odrzucić tę rezerwację.
  </p>

  <p>
    <a
      href="${bookingUrl}"
      style="
        display:inline-block;
        margin-top:10px;
        padding:10px 16px;
        background:#111827;
        color:white;
        text-decoration:none;
        border-radius:6px;
        font-weight:500;
      "
    >
      Zobacz rezerwację
    </a>
  </p>

  <div
    style="
      margin-top:18px;
      padding:14px;
      background:#e0f2fe;
      border:1px solid #7dd3fc;
      border-radius:8px;
    "
  >
    <strong>Ważne:</strong><br/>

    Płatność nie została jeszcze dokonana.<br/>

    Klient będzie mógł zapłacić dopiero po
    Twojej akceptacji rezerwacji.<br/><br/>

    Nie przekazuj przedmiotu przed potwierdzeniem
    płatności w aplikacji.
  </div>

  ${emailSignature()}

</div>
`,
        })
      : Promise.resolve(),

    /* ========================================================
       RENTER EMAIL

       El renter NO ve información sobre la comisión.
    ======================================================== */

    renterTo
      ? sendMail({
          to: renterTo,

          subject:
            `Nowa rezerwacja: ${listing.title}`,

          html: `
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#111; line-height:1.5;">

  <p>
    Cześć ${renter?.name ?? ""},
  </p>

  <p>
    Dziękujemy za Twoje zgłoszenie rezerwacji.
  </p>

  <div
    style="
      margin:16px 0;
      padding:16px;
      border:1px solid #e5e7eb;
      border-radius:8px;
      background:#fafafa;
    "
  >

    <p
      style="
        margin:0 0 8px 0;
        font-size:16px;
        font-weight:600;
      "
    >
      ${listing.title}
    </p>

    <p style="margin:4px 0;">
      <strong>Numer rezerwacji:</strong>
      ${ref}
    </p>

    <p style="margin:4px 0;">
      <strong>Daty:</strong>
      ${d(startDate)} → ${d(endDate)}
      (${days} ${pluralPLDay(days)})
    </p>

    <p style="margin:4px 0;">
      <strong>
        Kwota do zapłaty (po akceptacji):
      </strong>

      ${moneyPLN(total)}
    </p>

  </div>

  <p>
    Status rezerwacji:
    <strong>
      Oczekuje na zatwierdzenie przez właściciela
    </strong>
  </p>

  <p>
    Otrzymasz powiadomienie e-mail,
    gdy właściciel podejmie decyzję.
  </p>

  <p>
    <a
      href="${bookingUrl}"
      style="
        display:inline-block;
        margin-top:10px;
        padding:10px 16px;
        background:#111827;
        color:white;
        text-decoration:none;
        border-radius:6px;
        font-weight:500;
      "
    >
      Zobacz rezerwację
    </a>
  </p>

  <div
    style="
      margin-top:18px;
      padding:14px;
      background:#fef3c7;
      border:1px solid #fcd34d;
      border-radius:8px;
    "
  >
    <strong>Uwaga:</strong><br/>

    Na tym etapie nie dokonuj żadnej płatności.<br/>

    Płatność będzie możliwa dopiero po akceptacji
    rezerwacji przez właściciela.
  </div>

  ${emailSignature()}

</div>
`,
        })
      : Promise.resolve(),
  ]);

  /* ==========================================================
     REVALIDATE + REDIRECT
  ========================================================== */

  revalidatePath(
    `/listing/${listingId}`
  );

  revalidatePath(
    `/bookings`
  );

  redirect(
    "/bookings?ok=1"
  );
}
