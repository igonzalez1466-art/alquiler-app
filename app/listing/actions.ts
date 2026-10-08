"use server";

import { accountIdentityUrl, getRequiredIdentity } from "@/app/lib/identityRequirement";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/app/lib/mailer";

/* =====================================================
   CREATE LISTING (crear anuncio + email)
===================================================== */

export async function createListing(formData: FormData): Promise<void> {
  const session = (await getServerSession(authConfig)) as Session | null;
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  // ✅ Asegura tipo string (evita "any" y ayuda a Prisma)
  const uid: string = userId;
  if (!await getRequiredIdentity(uid)) redirect(accountIdentityUrl("/listing/new"));

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  // ✅ REQUIRED en schema: pricePerDay Int
  const pricePerDayRaw = String(formData.get("pricePerDay") ?? "").trim();
  const pricePerDay = Number(pricePerDayRaw);

  if (!title) throw new Error("Podaj tytuł ogłoszenia.");
  if (!Number.isFinite(pricePerDay) || !Number.isInteger(pricePerDay) || pricePerDay <= 0) {
    throw new Error("Cena za dzień musi być dodatnią liczbą całkowitą.");
  }

  // Crear anuncio
  const listing = await prisma.listing.create({
    data: {
      title,
      description: description || null,
      pricePerDay, // ✅ obligatorio
      available: true,

      // ✅ forma más limpia con Prisma (evita líos de CreateInput vs UncheckedCreateInput)
      user: { connect: { id: uid } },
    },
    select: { id: true, title: true },
  });

  // Email al propietario
  const owner = await prisma.user.findUnique({
    where: { id: uid },
    select: { email: true, name: true },
  });

  if (owner?.email) {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    try {
      await sendMail({
        to: owner.email,
        subject: "Twoje ogłoszenie zostało opublikowane",
        html: `
          <p>Cześć ${owner.name ?? ""},</p>
          <p>Twoje ogłoszenie <strong>${listing.title}</strong> zostało utworzone.</p>
          <p>
            <a href="${baseUrl}/listing/${listing.id}">
              Zobacz ogłoszenie
            </a>
          </p>
        `,
      });
    } catch (e) {
      // No rompas el flujo si el email falla
      console.error("[createListing] Error enviando email:", e);
    }
  }

  redirect("/listing");
}

/* =====================================================
   TOGGLE AVAILABLE (activar / desactivar anuncio)
===================================================== */

export async function toggleListingAvailable(formData: FormData): Promise<void> {
  const session = (await getServerSession(authConfig)) as Session | null;
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const uid: string = userId;

  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) throw new Error("Brak numeru ogłoszenia.");

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { userId: true, available: true, isDraft: true, _count: { select: { images: true } } },
  });

  if (!listing) throw new Error("Nie znaleziono ogłoszenia.");
  if (listing.userId !== uid) throw new Error("Brak uprawnień.");

  if (!listing.available && !await getRequiredIdentity(uid)) redirect(accountIdentityUrl(`/listing/${listingId}`));
  if (listing.isDraft && listing._count.images < 3) throw new Error("Dodaj co najmniej 3 zdjęcia przed publikacją.");

  await prisma.listing.update({
    where: { id: listingId },
    data: { available: !listing.available, isDraft: false },
  });

  // Revalidar páginas afectadas
  revalidatePath("/listing");
  revalidatePath(`/listing/${listingId}`);

  redirect(`/listing/${listingId}`);
}
