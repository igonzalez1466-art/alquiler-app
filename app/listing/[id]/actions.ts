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

// ✅ base URL estable para emails (NO usar NEXTAUTH_URL aquí)
function getEmailBaseUrl(): string {
  const raw = process.env.APP_URL || "http://localhost:3000";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

// ✅ Iniciar chat
export async function startChatAction(formData: FormData) {
  await initSqlitePragmas();

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
  await initSqlitePragmas();

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

  if (listing.available === false) {
    redirect(`/listing/${listingId}?error=anuncio-no-disponible`);
  }

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

  const renter = await prisma.user.findUnique({
    where: { id: renterId },
    select: { email: true, name: true },
  });

  const days = diffDaysInclusive(startDate, endDate);

  // ===== Cálculos económicos =====
  const alquiler = days * listing.pricePerDay;
  const comision = +(alquiler * 0.1).toFixed(2); // por si la necesitas luego
  const fianza = listing.fianza ?? 0;

  // Email estilo UI (sin comisión visible)
  const total = +(alquiler + fianza).toFixed(2);

  // Evita "unused" si no la usas por ahora
  void comision;

  const d = (x: Date) =>
    x.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

  const moneyPLN = (v: number) => `${new Intl.NumberFormat("pl-PL").format(v)} zł`;

  const subject = `Nowa rezerwacja: ${listing.title} (${d(startDate)} → ${d(endDate)})`;
  const baseUrl = getEmailBaseUrl();

  // ===== Bloque email "Płatność" similar a tu captura =====
  const htmlBlock = `
    <div style="max-width:640px;">
      <div style="font-family:Arial,Helvetica,sans-serif; color:#111; line-height:1.4;">
        <div style="border:1px solid #e6e6e6; border-radius:12px; overflow:hidden;">
          
          <div style="padding:16px 18px; border-bottom:1px solid #f0f0f0;">
            <div style="font-size:18px; font-weight:700; margin:0;">Płatność</div>
            <div style="font-size:13px; color:#666; margin-top:4px;">Podsumowanie kosztów rezerwacji</div>
          </div>

          <div style="padding:14px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td width="50%" style="padding-right:8px; vertical-align:top;">
                  <div style="border:1px solid #e6e6e6; border-radius:10px; padding:10px 12px;">
                    <div style="font-size:12px; color:#666;">Od</div>
                    <div style="font-size:14px; font-weight:700; margin-top:2px;">${d(startDate)}</div>
                  </div>
                </td>
                <td width="50%" style="padding-left:8px; vertical-align:top;">
                  <div style="border:1px solid #e6e6e6; border-radius:10px; padding:10px 12px;">
                    <div style="font-size:12px; color:#666;">Do</div>
                    <div style="font-size:14px; font-weight:700; margin-top:2px;">${d(endDate)}</div>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <div style="padding:0 18px 12px 18px;">
            <div style="border:1px solid #e6e6e6; border-radius:12px; overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:14px;">
                <tr>
                  <td style="padding:10px 12px; border-bottom:1px solid #f0f0f0; color:#333;">Liczba dni</td>
                  <td style="padding:10px 12px; border-bottom:1px solid #f0f0f0; text-align:right; font-weight:700;">${days}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px; border-bottom:1px solid #f0f0f0; color:#333;">Cena za dzień</td>
                  <td style="padding:10px 12px; border-bottom:1px solid #f0f0f0; text-align:right; font-weight:700;">${moneyPLN(listing.pricePerDay)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px; border-bottom:1px solid #f0f0f0; color:#333;">Koszt najmu</td>
                  <td style="padding:10px 12px; border-bottom:1px solid #f0f0f0; text-align:right; font-weight:700;">${moneyPLN(alquiler)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px; color:#333;">Kaucja (zwrotna)</td>
                  <td style="padding:10px 12px; text-align:right; font-weight:700;">${moneyPLN(fianza)}</td>
                </tr>
              </table>
            </div>
          </div>

          <div style="padding:0 18px 16px 18px;">
            <div style="background:#eef4ff; border:1px solid #dbe7ff; border-radius:12px; padding:14px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="font-size:14px; font-weight:700;">Razem do zapłaty</td>
                  <td style="text-align:right; font-size:18px; font-weight:800; color:#1f4cff;">${moneyPLN(total)}</td>
                </tr>
              </table>
            </div>
          </div>

          <div style="padding:0 18px 18px 18px;">
            <div style="border:1px solid #e6e6e6; border-radius:12px; padding:10px 12px; font-size:12px; color:#444;">
              Kaucja jest zwrotna zgodnie z warunkami (po zwrocie produktu i potwierdzeniu braku uszkodzeń).
            </div>
          </div>

          <div style="padding:0 18px 18px 18px;">
            <div style="font-size:12px; color:#666;">
              Status: <strong style="color:#111;">${booking.status}</strong>
            </div>
            <div style="margin-top:8px;">
              <a href="${baseUrl}/bookings" style="color:#2563eb; text-decoration:underline; font-size:14px;">Zobacz rezerwacje</a>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  const ownerTo = listing.user?.email?.trim() || "";
  const renterTo = renter?.email?.trim() || "";

  await Promise.allSettled([
    ownerTo
      ? sendMail({
          to: ownerTo,
          subject,
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif; color:#111; line-height:1.4;">
              <p>Cześć ${listing.user?.name ?? ""}, Masz nowe zgłoszenie rezerwacji.</p>
              <p><strong>Przejdź do rezerwacji, aby ją zatwierdzić lub odrzucić:</strong></p>
              ${htmlBlock}
              <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
              <p style="margin:0; font-size:13px; color:#444;">Klient: ${renter?.name ?? "Użytkownik"}</p>
            </div>
          `,
        })
      : Promise.resolve(),

    renterTo
      ? sendMail({
          to: renterTo,
          subject,
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif; color:#111; line-height:1.4;">
              <p>Cześć ${renter?.name ?? ""}, Dziękujemy za Twoje zgłoszenie rezerwacji.</p>
              ${htmlBlock}
            </div>
          `,
        })
      : Promise.resolve(),
  ]);

  revalidatePath(`/listing/${listingId}`);
  revalidatePath(`/bookings`);
  redirect("/bookings?ok=1");
}
