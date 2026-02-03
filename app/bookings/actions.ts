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

  const s = fmt(start);
  const e = fmt(end);
  const title = listing.title ?? "tu artículo";

  /* EMAIL AL PROPIETARIO */
  if (booking.listing.user?.email) {
    await sendMail({
      to: booking.listing.user.email,
      subject: `Nowa prośba o rezerwację: ${title}`,
      html: `<p>Cześć ${
        booking.listing.user.name ?? "propietario"
      },</p>
             <p>${booking.renter?.name ?? "un usuario"} chce dokonać rezerwacji <b>${title}</b>.</p>
             <p>Daty: <b>${s}</b> → <b>${e}</b></p>
             <p>możesz zaakceptować lub odrzucić w swoim panelu.</p>`,
    });
  }

  /* EMAIL AL INQUILINO */
  if (booking.renter?.email) {
    await sendMail({
      to: booking.renter.email,
      subject: `Wniosek wysłany na ${title}`,
      html: `<p>Cześć ${
        booking.renter.name ?? "usuario"
      },</p>
             <p>Twoje zgłoszenie dotyczące <b>${title}</b> (${s} → ${e}) zostało wysłane do właściciela.</p>
             <p>Poinformujemy Cię, gdy właściciel ją zatwierdzi.</p>`,
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

  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CONFIRMED" },
  });

  const title = booking.listing.title ?? "tu artículo";
  const s = fmt(booking.startDate);
  const e = fmt(booking.endDate);

  /* EMAIL AL INQUILINO */
  if (booking.renter?.email) {
    await sendMail({
      to: booking.renter.email,
      subject: `Rezerwacja potwierdzona: ${title}`,
      html: `<p>Cześć ${
        booking.renter.name ?? "usuario"
      },</p>
             <p>Twoja rezerwacja <b>${title}</b> (${s} → ${e}) została <b>potwierdzona</b>.</p>
             <p>Skontaktuj się z właścicielem, aby ustalić sposób odbioru lub dostawy.</p>`,
    });
  }

  /* EMAIL AL PROPIETARIO */
  if (booking.listing.user?.email) {
    await sendMail({
      to: booking.listing.user.email,
      subject: `Potwierdziłeś rezerwację ${title}`,
      html: `<p>Cześć ${
        booking.listing.user.name ?? "propietario"
      },</p>
             <p>Potwierdziłeś rezerwację <b>${title}</b> dla ${
        booking.renter?.name ?? "el usuario"
      }.</p>
             <p>Daty: ${s} → ${e}</p>`,
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

if (booking.renter?.email) {
  await sendMail({
    to: booking.renter.email,
    subject: `Rezerwacja odrzucona: ${title}`,
    html: `
      <p>Cześć ${booking.renter.name ?? "Użytkowniku"},</p>

      <p>
        Właściciel odrzucił Twoją rezerwację
        <strong>${title}</strong>.
      </p>

      <p>Daty: ${s} → ${e}</p>

      <hr style="margin:16px 0;" />

      <p style="font-size:13px; color:#555;">
        Pozdrawiamy,<br/>
        <strong>Zespół Rentify</strong>
      </p>
    `,
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
