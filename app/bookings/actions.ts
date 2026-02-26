// app/bookings/actions.ts
"use server";

import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/app/lib/mailer";
// import Stripe from "stripe"; // 🔴 Stripe desactivado por ahora

/* ============================================
   UTILITY
=============================================== */
function fmt(d: Date | string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(dt.getDate()).padStart(2, "0")}`;
}

/* ============================================
   FIRMA EMAIL (UNA SOLA VEZ)
=============================================== */
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

/* ============================================
   CREATE BOOKING — con validación anti-solapamiento
=============================================== */
export async function createBookingAction(input: {
  listingId: string;
  startDate: string;
  endDate: string;
}) {
  const session = (await getServerSession(authConfig)) as Session | null;
  const renterId = session?.user?.id;
  if (!renterId) throw new Error("No autenticado");

  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    include: { user: true },
  });

  if (!listing) throw new Error("Anuncio no encontrado");
  if (listing.userId === renterId)
    throw new Error("No puedes reservar tu propio artículo");

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime()))
    throw new Error("Fechas inválidas.");
  if (end <= start)
    throw new Error("La fecha de fin debe ser posterior a la fecha de inicio.");

  // 💥 VALIDACIÓN DE SOLAPAMIENTO
  const overlapping = await prisma.booking.findFirst({
    where: {
      listingId: input.listingId,
      status: { in: ["PENDING", "CONFIRMED", "PAID"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });

  if (overlapping) throw new Error("Estas fechas ya están reservadas.");

  const booking = await prisma.booking.create({
    data: {
      listingId: input.listingId,
      renterId,
      startDate: start,
      endDate: end,
      status: "PENDING",
    },
    include: {
      renter: true,
      listing: { include: { user: true } },
    },
  });

  const ref = `#${booking.bookingNumber}`;

  const s = fmt(start);
  const e = fmt(end);
  const title = listing.title ?? "tu artículo";

  /* EMAIL AL PROPIETARIO */
  if (booking.listing.user?.email) {
    await sendMail({
      to: booking.listing.user.email,
      subject: `Nowa prośba o rezerwację ${ref}: ${title}`,
      html: `
        <p>Cześć ${booking.listing.user.name ?? "propietario"},</p>
        <p><b>Numer rezerwacji:</b> ${ref}</p>
        <p>${booking.renter?.name ?? "un usuario"} chce dokonać rezerwacji <b>${title}</b>.</p>
        <p>Daty: <b>${s}</b> → <b>${e}</b></p>
        <p>możesz zaakceptować lub odrzucić w swoim panelu.</p>
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
        <p>Cześć ${booking.renter.name ?? "usuario"},</p>
        <p><b>Numer rezerwacji:</b> ${ref}</p>
        <p>Twoje zgłoszenie dotyczące <b>${title}</b> (${s} → ${e}) zostało wysłane do właściciela.</p>
        <p>Poinformujemy Cię, gdy właściciel ją zatwierdzi.</p>
        ${emailSignature()}
      `,
    });
  }

  revalidatePath("/bookings");
  revalidatePath(`/listing/${listing.id}`);

  return { bookingId: booking.id, status: booking.status };
}

/* ============================================
   APPROVE BOOKING — sin pagos (CONFIRMED)
=============================================== */
export async function approveBookingAction(bookingId: string) {
  const session = (await getServerSession(authConfig)) as Session | null;
  const userId = session?.user?.id;
  if (!userId) throw new Error("No autenticado");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: { include: { user: true } },
      renter: true,
    },
  });

  if (!booking) throw new Error("Reserva no encontrada");
  if (booking.listing.userId !== userId) throw new Error("No autorizado");
  if (booking.status !== "PENDING")
    throw new Error("Esta reserva ya fue procesada");

  const ref = `#${booking.bookingNumber}`;
  
  // ✅ calcula días (mínimo 1)
  const ms = booking.endDate.getTime() - booking.startDate.getTime();
  const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));

  // ✅ precio/día y fianza desde Listing
  const pricePerDay = booking.listing.pricePerDay; // Int (zł)
  const deposit = booking.listing.fianza ?? 0; // Int | null (zł)

  // ✅ total en zł
const total = pricePerDay * days + deposit;

// ✅ formatter PLN
const moneyPLN = (v: number) =>
  `${new Intl.NumberFormat("pl-PL").format(v)} zł`;

  if (!pricePerDay || pricePerDay <= 0) {
    throw new Error("El anuncio no tiene un precio por día válido.");
  }

  // ✅ convertir a grosz para Stripe
  const rentAmountCents = pricePerDay * days * 100;
  const depositCents = deposit * 100;

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CONFIRMED",
      amountCents: rentAmountCents,
      depositCents: depositCents,
    },
  });

  const title = booking.listing.title ?? "tu artículo";
  const s = fmt(booking.startDate);
  const e = fmt(booking.endDate);

  /* EMAIL AL INQUILINO */
  if (booking.renter?.email) {
    await sendMail({
      to: booking.renter.email,
      subject: `Rezerwacja potwierdzona ${ref}: ${title}`,
   html: `
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#111; line-height:1.5;">

  <p>Cześć ${booking.renter?.name ?? ""},</p>

  <p>
    Twoja rezerwacja została <strong>zatwierdzona przez właściciela</strong>.
  </p>

  <!-- CARD -->
  <div style="margin:16px 0; padding:16px; border:1px solid #e5e7eb; border-radius:8px; background:#fafafa;">
    
    <p style="margin:0 0 8px 0; font-size:16px; font-weight:600;">
      ${booking.listing.title}
    </p>

    <p style="margin:4px 0;">
      <strong>Numer rezerwacji:</strong> #${booking.bookingNumber}
    </p>

    <p style="margin:4px 0;">
      <strong>Daty:</strong> ${s} → ${e}
    </p>

    <p style="margin:4px 0;">
      <strong>Kwota do zapłaty:</strong> ${moneyPLN(total)}
    </p>

  </div>

  <p style="margin-top:12px;">
    Aby sfinalizować rezerwację, dokonaj płatności w aplikacji.
  </p>

  <p>
    <a href="${process.env.APP_URL}/bookings/${booking.id}/pay" 
       style="display:inline-block; margin-top:12px; padding:12px 18px; 
              background:#16a34a; color:white; text-decoration:none; 
              border-radius:6px; font-weight:600;">
      Opłać rezerwację
    </a>
  </p>

  <div style="margin-top:18px; padding:14px; background:#fef3c7; border:1px solid #fcd34d; border-radius:8px;">
    <strong>Ważne:</strong><br/>
    Rezerwacja będzie ważna dopiero po zaksięgowaniu płatności.<br/>
    Po potwierdzeniu płatności otrzymasz kolejne powiadomienie.
  </div>

  ${emailSignature()}

</div>
`
    });
  }

  /* EMAIL AL PROPIETARIO */
  if (booking.listing.user?.email) {
    await sendMail({
      to: booking.listing.user.email,
      subject: `Potwierdziłeś rezerwację ${ref}: ${title}`,
      html: `
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#111; line-height:1.5;">

  <p>Cześć ${booking.listing.user.name ?? ""},</p>

  <p>
    Pomyślnie <strong>zatwierdziłeś rezerwację</strong>.
  </p>

  <!-- CARD -->
  <div style="margin:16px 0; padding:16px; border:1px solid #e5e7eb; border-radius:8px; background:#fafafa;">
    
    <p style="margin:0 0 8px 0; font-size:16px; font-weight:600;">
      ${booking.listing.title}
    </p>

    <p style="margin:4px 0;">
      <strong>Numer rezerwacji:</strong> #${booking.bookingNumber}
    </p>

    <p style="margin:4px 0;">
      <strong>Klient:</strong> ${booking.renter?.name ?? "Użytkownik"}
    </p>

    <p style="margin:4px 0;">
      <strong>Daty:</strong> ${s} → ${e}
    </p>

  </div>

  <p>
    Rezerwacja oczekuje teraz na dokonanie płatności przez klienta.
  </p>

  <p>
    Otrzymasz osobne powiadomienie e-mail,
    gdy płatność zostanie potwierdzona.
  </p>

  <!-- WARNING BOX -->
  <div style="margin-top:18px; padding:14px; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; color:#991b1b;">
    <strong>Ważne:</strong><br/>
    Nie przekazuj przedmiotu do momentu potwierdzenia płatności w aplikacji.
  </div>

  <p>
    <a href="${process.env.APP_URL}/bookings/${booking.id}" 
       style="display:inline-block; margin-top:14px; padding:10px 16px; 
              background:#111827; color:white; text-decoration:none; 
              border-radius:6px; font-weight:500;">
      Zobacz szczegóły rezerwacji
    </a>
  </p>

  ${emailSignature()}

</div>
`
    });
  }

  revalidatePath("/bookings");
  return { ok: true };
}

/* ============================================
   REJECT BOOKING ✅ + CLOSE CHAT (ROBUSTO)
=============================================== */
export async function rejectBookingAction(bookingId: string) {
  const session = (await getServerSession(authConfig)) as Session | null;
  const userId = session?.user?.id;
  if (!userId) throw new Error("No autenticado");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: { include: { user: true } },
      renter: true,
    },
  });

  if (!booking) throw new Error("Reserva no encontrada");
  if (booking.listing.userId !== userId) throw new Error("No autorizado");
  if (booking.status !== "PENDING")
    throw new Error("Solo reservas pendientes pueden rechazarse");

  const ref = `#${booking.bookingNumber}`;

  // ✅ 1) Cancelar booking
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED" },
  });

  // ✅ 2) Cerrar conversación SI EXISTE (sin depender de status=OPEN)
  const conv = await prisma.conversation.findUnique({
    where: {
      listingId_buyerId: {
        listingId: booking.listingId,
        buyerId: booking.renterId,
      },
    },
    select: { id: true, status: true },
  });

  if (conv) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedReason: "BOOKING_CANCELLED_BY_OWNER",
      },
    });

    revalidatePath(`/chat/${conv.id}`);
  }

  const title = booking.listing.title ?? "tu artículo";
  const s = fmt(booking.startDate);
  const e = fmt(booking.endDate);

  /* EMAIL AL INQUILINO */
  if (booking.renter?.email) {
    await sendMail({
      to: booking.renter.email,
      subject: `Rezerwacja odrzucona ${ref}: ${title}`,
      html: `
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#111; line-height:1.5;">

  <p>Cześć ${booking.renter?.name ?? ""},</p>

  <p>
    Niestety właściciel odrzucił Twoją rezerwację.
  </p>

  <!-- CARD -->
  <div style="margin:16px 0; padding:16px; border:1px solid #e5e7eb; border-radius:8px; background:#fafafa;">
    
    <p style="margin:0 0 8px 0; font-size:16px; font-weight:600;">
      ${booking.listing.title}
    </p>

    <p style="margin:4px 0;">
      <strong>Numer rezerwacji:</strong> #${booking.bookingNumber}
    </p>

    <p style="margin:4px 0;">
      <strong>Daty:</strong> ${s} → ${e}
    </p>

  </div>

  <div style="margin-top:14px; padding:14px; background:#f3f4f6; border-radius:8px;">
    Możesz spróbować wybrać inne daty lub znaleźć podobny przedmiot dostępny w tym terminie.
  </div>

  <p>
    <a href="${process.env.APP_URL}/listing/${booking.listing.id}" 
       style="display:inline-block; margin-top:14px; padding:10px 16px; 
              background:#111827; color:white; text-decoration:none; 
              border-radius:6px; font-weight:500;">
      Zobacz ogłoszenie
    </a>
  </p>

  ${emailSignature()}

</div>
`
    });
  }

  revalidatePath("/bookings");
  revalidatePath("/chat");

  // ✅ útil para depurar en el frontend
  return { ok: true, closedChat: !!conv };
}

/* ============================================
   STRIPE CHECKOUT (DESACTIVADO)
=============================================== */

/*
export async function createCheckoutSessionAction(bookingId: string) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) throw new Error("No autorizado");

  // Aquí iría todo tu código de Stripe...

  // return { url: sessionStripe.url! };
}
*/