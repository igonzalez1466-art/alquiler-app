// app/api/bookings/[id]/approve/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendMail } from "@/app/lib/mailer";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_req: Request, ctx: Ctx) {
  const { id: bookingId } = await ctx.params;

  // 1) Traer datos necesarios (Booking + Listing + Owner + Renter)
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          user: { select: { email: true, name: true } }, // owner
        },
      },
      renter: { select: { email: true, name: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const ownerEmail = booking.listing?.user?.email ?? null;
  const ownerName = booking.listing?.user?.name ?? "Propietario";
  const renterEmail = booking.renter?.email ?? null;
  const renterName = booking.renter?.name ?? "Usuario";
  const listingTitle = booking.listing?.title ?? "Artículo";

  if (!ownerEmail || !renterEmail) {
    return NextResponse.json(
      { error: "Faltan emails (owner/renter)" },
      { status: 400 }
    );
  }

  // 2) Aceptar (idempotente) — ajusta si tu enum no es CONFIRMED
  if (booking.status !== "CONFIRMED") {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CONFIRMED" },
    });
  }

  const start = fmt(booking.startDate);
  const end = fmt(booking.endDate);

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  // 3) Enviar emails (sin flags)
  try {
    await sendMail({
      to: renterEmail,
      subject: `✅ Reserva confirmada: ${listingTitle}`,
      html: renterApprovedHtml({
        renterName,
        listingTitle,
        ownerName,
        startDate: start,
        endDate: end,
        bookingId,
        baseUrl,
      }),
    });

    await sendMail({
      to: ownerEmail,
      subject: `Has confirmado la reserva de ${listingTitle}`,
      html: ownerApprovedHtml({
        ownerName,
        renterName,
        listingTitle,
        startDate: start,
        endDate: end,
        bookingId,
        baseUrl,
      }),
    });
  } catch (err) {
    console.error("Email approve error:", err);
    // aceptamos igualmente aunque falle correo
    return NextResponse.json(
      { bookingId, status: "CONFIRMED", email_error: true },
      { status: 207 }
    );
  }

  return NextResponse.json({ bookingId, status: "CONFIRMED" }, { status: 200 });
}

/* ===================== helpers ===================== */

function fmt(d: Date) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

function renterApprovedHtml(p: {
  renterName: string;
  listingTitle: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  bookingId: string;
  baseUrl: string;
}) {
  return `
  <div style="font-family:Arial,sans-serif">
    <h2>¡Listo, ${esc(p.renterName)}! 🎉</h2>
    <p>Tu reserva de <strong>${esc(p.listingTitle)}</strong> ha sido confirmada por ${esc(
    p.ownerName
  )}.</p>
    <p><b>Fechas:</b> ${p.startDate} → ${p.endDate}</p>
    <p>
      <a href="${p.baseUrl}/bookings/${p.bookingId}"
         style="display:inline-block;padding:10px 12px;border:1px solid #222;border-radius:8px;text-decoration:none">
        Ver detalles
      </a>
    </p>
  </div>`;
}

function ownerApprovedHtml(p: {
  ownerName: string;
  renterName: string;
  listingTitle: string;
  startDate: string;
  endDate: string;
  bookingId: string;
  baseUrl: string;
}) {
  return `
  <div style="font-family:Arial,sans-serif">
    <h2>Gracias, ${esc(p.ownerName)} 👍</h2>
    <p>Has confirmado la reserva de <strong>${esc(p.listingTitle)}</strong> para ${esc(
    p.renterName
  )}.</p>
    <p><b>Fechas:</b> ${p.startDate} → ${p.endDate}</p>
    <p>
      <a href="${p.baseUrl}/bookings/${p.bookingId}"
         style="display:inline-block;padding:10px 12px;border:1px solid #222;border-radius:8px;text-decoration:none">
        Ver reserva
      </a>
    </p>
  </div>`;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]!));
}
