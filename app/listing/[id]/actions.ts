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

// ✅ pluralización polaca
function pluralPLDay(n: number) {
  return n === 1 ? "dzień" : "dni";
}

// ✅ base URL estable para emails
function getEmailBaseUrl(): string {
  const raw = process.env.APP_URL || "http://localhost:3000";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

// ✅ Firma FIJA (sin env, sin Vercel)
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

// ✅ Iniciar chat
export async function startChatAction(formData: FormData) {

  const session = (await getServerSession(authConfig)) as Session | null;
  const currentUserId = session?.user?.id;
  if (!currentUserId) redirect("/login");

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

// ✅ Crear reserva + emails
export async function createBookingAction(formData: FormData) {

  const session = (await getServerSession(authConfig)) as Session | null;
  const renterId = session?.user?.id;
  if (!renterId) redirect("/login");

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

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      pricePerDay: true,
      fianza: true,
      userId: true,
      available: true,
      user: { select: { email: true, name: true } },
    },
  });

  if (!listing) redirect(`/listing/${listingId}?error=anuncio-no-encontrado`);
  if (listing.userId === renterId) redirect(`/listing/${listingId}?error=no-propio`);
  if (listing.available === false) redirect(`/listing/${listingId}?error=anuncio-no-disponible`);

  const booking = await prisma.$transaction(async (tx) => {
    const overlap = await tx.booking.findFirst({
      where: {
        listingId,
        status: { in: ["PENDING", "CONFIRMED"] },
        AND: [{ startDate: { lt: endDate } }, { endDate: { gt: startDate } }],
      },
      select: { id: true },
    });

    if (overlap) redirect(`/listing/${listingId}?error=fechas-no-disponibles`);

    return tx.booking.create({
      data: { listingId, renterId, startDate, endDate, status: "PENDING" },
      select: { id: true,bookingNumber: true, startDate: true, endDate: true, status: true },
    });
  });

  const renter = await prisma.user.findUnique({
    where: { id: renterId },
    select: { email: true, name: true },
  });

  const days = diffDaysInclusive(startDate, endDate);
  const alquiler = days * listing.pricePerDay;
  const fianza = listing.fianza ?? 0;
  const total = alquiler + fianza;

  const d = (x: Date) =>
    x.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

  const moneyPLN = (v: number) => `${new Intl.NumberFormat("pl-PL").format(v)} zł`;
  const baseUrl = getEmailBaseUrl();

  const htmlBlock = `
    <h3>${listing.title}</h3>
    <p><strong>Daty:</strong> ${d(startDate)} → ${d(endDate)} (${days} ${pluralPLDay(days)})</p>
    <p><strong>Razem do zapłaty:</strong> ${moneyPLN(total)}</p>
    <p><a href="${baseUrl}/bookings">Zobacz rezerwacje</a></p>
  `;
  const ref = `#${booking.bookingNumber}`;
  const ownerTo = listing.user?.email?.trim() || "";
  const renterTo = renter?.email?.trim() || "";

  await Promise.allSettled([
   ownerTo
  ? sendMail({
      to: ownerTo,
      subject: `Nowa rezerwacja: ${listing.title}`,
      html: `
        <p>Cześć ${listing.user?.name ?? ""},</p>

        <p>
          Otrzymałeś nowe zgłoszenie rezerwacji
          <strong>${listing.title}</strong>.
        </p>

        <p><strong>Numer rezerwacji: ${ref}</strong></p>

        <p>
          <strong>
            Przejdź do szczegółów rezerwacji pod poniższym linkiem
            i zatwierdź ją lub odrzuć.
          </strong>
        </p>

        ${htmlBlock}

        <p style="margin-top:12px; font-size:13px; color:#444;">
          Klient: ${renter?.name ?? "Użytkownik"}
        </p>

        ${emailSignature()}
      `,
    })
  : Promise.resolve(),


    renterTo
      ? sendMail({
          to: renterTo,
          subject: `Nowa rezerwacja: ${listing.title}`,
          html: `
            <p>Cześć ${renter?.name ?? ""},</p>
            
            <p>Dziękujemy za Twoje zgłoszenie rezerwacji.</p>

             <p><strong>Numer rezerwacji: ${ref}</strong></p>

            ${htmlBlock}
            ${emailSignature()}
          `,
        })
      : Promise.resolve(),
  ]);

  revalidatePath(`/listing/${listingId}`);
  revalidatePath(`/bookings`);
  redirect("/bookings?ok=1");
}
