import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/app/lib/mailer";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;

  // 1) Traer datos necesarios
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      bike: { include: { owner: { select: { email: true, name: true } } } },
      renter: { select: { email: true, name: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }
  if (!booking.bike?.owner?.email || !booking.renter?.email) {
    return NextResponse.json({ error: "Faltan emails" }, { status: 400 });
  }

  // 2) Aceptar (idempotente)
  if (booking.status !== "accepted") {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "accepted" },
    });
  }

  // 3) Enviar emails con flags para no duplicar
  const fresh = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      notificationApprovedToRenterSent: true,
      notificationApprovedToOwnerSent: true,
    },
  });

  if (!fresh) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const start = fmt(fresh.startDate);
  const end = fmt(fresh.endDate);
  const bikeTitle = booking.bike.title;

  const toRenter = {
    to: booking.renter.email,
    subject: `✅ Reserva confirmada: ${bikeTitle}`,
    html: renterApprovedHtml({
      renterName: booking.renter.name ?? "Ciclista",
      bikeTitle,
      ownerName: booking.bike.owner.name ?? "Propietario",
      startDate: start,
      endDate: end,
      bookingId,
    }),
  };

  const toOwner = {
    to: booking.bike.owner.email,
    subject: `Has confirmado la reserva de ${bikeTitle}`,
    html: ownerApprovedHtml({
      ownerName: booking.bike.owner.name ?? "Propietario",
      renterName: booking.renter.name ?? "Inquilino",
      bikeTitle,
      startDate: start,
      endDate: end,
      bookingId,
    }),
  };

  const results: { renter?: boolean; owner?: boolean } = {};

  try {
    if (!fresh.notificationApprovedToRenterSent) {
      await sendMail(toRenter);
      await prisma.booking.update({
        where: { id: bookingId },
        data: { notificationApprovedToRenterSent: true },
      });
      results.renter = true;
    }

    if (!fresh.notificationApprovedToOwnerSent) {
      await sendMail(toOwner);
      await prisma.booking.update({
        where: { id: bookingId },
        data: { notificationApprovedToOwnerSent: true },
      });
      results.owner = true;
    }
  } catch (err) {
    console.error("Email approve error:", err);
    return NextResponse.json(
      { bookingId, status: "accepted", email_error: true, results },
      { status: 207 }
    );
  }

  return NextResponse.json({ bookingId, status: "accepted", results }, { status: 200 });
}

function fmt(d: Date) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

function renterApprovedHtml(p: {
  renterName: string; bikeTitle: string; ownerName: string; startDate: string; endDate: string; bookingId: string;
}) {
  return `
  <div style="font-family:Arial,sans-serif">
    <h2>¡Listo, ${esc(p.renterName)}! 🎉</h2>
    <p>Tu reserva de <strong>${esc(p.bikeTitle)}</strong> ha sido confirmada por ${esc(p.ownerName)}.</p>
    <p><b>Fechas:</b> ${p.startDate} → ${p.endDate}</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/bookings/${p.bookingId}"
          style="display:inline-block;padding:10px 12px;border:1px solid #222;border-radius:8px;text-decoration:none">
      Ver detalles
    </a></p>
  </div>`;
}

function ownerApprovedHtml(p: {
  ownerName: string; renterName: string; bikeTitle: string; startDate: string; endDate: string; bookingId: string;
}) {
  return `
  <div style="font-family:Arial,sans-serif">
    <h2>Gracias, ${esc(p.ownerName)} 👍</h2>
    <p>Has confirmado la reserva de <strong>${esc(p.bikeTitle)}</strong> para ${esc(p.renterName)}.</p>
    <p><b>Fechas:</b> ${p.startDate} → ${p.endDate}</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings/${p.bookingId}"
          style="display:inline-block;padding:10px 12px;border:1px solid #222;border-radius:8px;text-decoration:none">
      Ver reserva
    </a></p>
  </div>`;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;" }[m]!));
}
