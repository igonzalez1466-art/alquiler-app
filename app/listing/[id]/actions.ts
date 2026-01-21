"use server";

import { prisma, initSqlitePragmas } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/app/lib/mailer";

// ===== Helper días (incluye el día inicial) =====
function diffDaysInclusive(a: Date, b: Date) {
  const start = new Date(Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()));
  const end = new Date(Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()));
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

// ✅ Iniciar chat
export async function startChatAction(formData: FormData) {
  await initSqlitePragmas(); // ✅ importante para evitar locks/timeout en SQLite

  const session = (await getServerSession(authConfig)) as Session | null;
  const currentUserId = session?.user?.id;
  if (!currentUserId) redirect("/api/auth/signin");

  const listingId = formData.get("listingId")?.toString();
  const ownerId = formData.get("ownerId")?.toString();
  if (!listingId || !ownerId) throw new Error("Datos incompletos");
  if (currentUserId === ownerId) redirect("/");

  const existing = await prisma.conversation.findUnique({
    where: { listingId_buyerId: { listingId, buyerId: currentUserId } },
    select: { id: true },
  });
  if (existing) redirect(`/chat/${existing.id}`);

  const created = await prisma.conversation.create({
    data: { listingId, buyerId: currentUserId, sellerId: ownerId },
    select: { id: true },
  });

  redirect(`/chat/${created.id}`);
}

// ✅ Crear reserva + emails (con chequeo de disponibilidad del anuncio)
export async function createBookingAction(formData: FormData) {
  await initSqlitePragmas(); // ✅ importante para evitar locks/timeout en SQLite

  const session = (await getServerSession(authConfig)) as Session | null;
  const renterId = session?.user?.id;
  if (!renterId) redirect("/api/auth/signin");

  const listingId = formData.get("listingId")?.toString();
  const startStr = formData.get("startDate")?.toString();
  const endStr = formData.get("endDate")?.toString();

  if (!listingId || !startStr || !endStr) {
    redirect(`/listing/${listingId ?? ""}?error=datos-incompletos`);
  }

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    redirect(`/listing/${listingId}?error=fechas-invalidas`);
  }
  if (endDate <= startDate) {
    redirect(`/listing/${listingId}?error=fin-no-posterior`);
  }

  // Anuncio + propietario (incluye available para impedir reservas si está oculto)
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      pricePerDay: true,
      fianza: true,
      userId: true,
      available: true,
      user: { select: { email: true, name: true } }, // owner
    },
  });

  if (!listing) redirect(`/listing/${listingId}?error=anuncio-no-encontrado`);
  if (listing.userId === renterId) redirect(`/listing/${listingId}?error=no-propio`);

  // Si el anuncio está oculto, bloquear creación
  if (listing.available === false) {
    redirect(`/listing/${listingId}?error=anuncio-no-disponible`);
  }

  // ✅ Transacción: solapamiento + create (evita carreras y reduce locks raros)
  const booking = await prisma.$transaction(async (tx) => {
    const overlap = await tx.booking.findFirst({
      where: {
        listingId,
        status: { in: ["PENDING", "CONFIRMED"] },
        AND: [{ startDate: { lt: endDate } }, { endDate: { gt: startDate } }],
      },
      select: { id: true },
    });

    if (overlap) {
      redirect(`/listing/${listingId}?error=fechas-no-disponibles`);
    }

    return tx.booking.create({
      data: { listingId, renterId, startDate, endDate, status: "PENDING" },
      select: { id: true, startDate: true, endDate: true, status: true },
    });
  });

  // Inquilino
  const renter = await prisma.user.findUnique({
    where: { id: renterId },
    select: { email: true, name: true },
  });

  // Desglose (lo seguimos calculando por si lo necesitas en el futuro)
  const days = diffDaysInclusive(startDate, endDate);
  const alquiler = days * listing.pricePerDay;
  const comision = +(alquiler * 0.1).toFixed(2);
  const fianza = listing.fianza ?? 0;
  const total = +(alquiler + comision + fianza).toFixed(2);

  const fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
  const d = (x: Date) =>
    x.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

  const subject = `Nowa rezerwacja: ${listing.title} (${d(startDate)} → ${d(endDate)})`;

  // Email SIN precios
  const htmlBlock = `
    <h3>${listing.title}</h3>
    <p><strong>Daty:</strong> ${d(startDate)} → ${d(endDate)} (${days} días)</p>
    <p>Status: <strong>${booking.status}</strong></p>
    <p><a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/bookings">
      Zobacz rezerwacje
    </a></p>
  `;

  // Emails (propietario + inquilino)
  await Promise.allSettled([
    sendMail({
      to: listing.user?.email || "",
      subject,
      html: `
        <p>Cześć ${listing.user?.name ?? ""}, Masz nowe zgłoszenie rezerwacji.</p>
        ${htmlBlock}
        <hr/>
        <p>Cliente: ${renter?.name ?? "Usuario"} (${renter?.email ?? "sin email"})</p>
      `,
    }),
    sendMail({
      to: renter?.email || "",
      subject,
      html: `
        <p>Cześć ${renter?.name ?? ""}, Dziękujemy za Twoje zgłoszenie rezerwacji.</p>
        ${htmlBlock}
      `,
    }),
  ]);

  // Revalidaciones
  revalidatePath(`/listing/${listingId}`);
  revalidatePath(`/bookings`);
  redirect("/bookings?ok=1");
}
