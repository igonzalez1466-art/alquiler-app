"use server";

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
  if (!userId) redirect("/api/auth/signin");

  // ✅ Asegura tipo string (evita "any" y ayuda a Prisma)
  const uid: string = userId;

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  // ✅ REQUIRED en schema: pricePerDay Int
  const pricePerDayRaw = String(formData.get("pricePerDay") ?? "").trim();
  const pricePerDay = Number(pricePerDayRaw);

  if (!title) throw new Error("Falta el título");
  if (!Number.isFinite(pricePerDay) || !Number.isInteger(pricePerDay) || pricePerDay <= 0) {
    throw new Error("pricePerDay inválido (debe ser entero positivo)");
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
        subject: "Tu anuncio ha sido publicado",
        html: `
          <p>Hola ${owner.name ?? ""},</p>
          <p>Tu anuncio <strong>${listing.title}</strong> se ha creado correctamente.</p>
          <p>
            <a href="${baseUrl}/listing/${listing.id}">
              Ver anuncio
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
  if (!userId) redirect("/api/auth/signin");

  const uid: string = userId;

  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) throw new Error("Missing listingId");

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { userId: true, available: true },
  });

  if (!listing) throw new Error("Listing not found");
  if (listing.userId !== uid) throw new Error("Not allowed");

  await prisma.listing.update({
    where: { id: listingId },
    data: { available: !listing.available },
  });

  // Revalidar páginas afectadas
  revalidatePath("/listing");
  revalidatePath(`/listing/${listingId}`);

  redirect(`/listing/${listingId}`);
}
