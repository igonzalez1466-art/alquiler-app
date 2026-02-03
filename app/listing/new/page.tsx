// app/listing/new/page.tsx
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import LocationField from "./LocationField";
import { sendMail } from "@/app/lib/mailer";
import type { Gender, GarmentType, Color } from "@prisma/client";
import { put } from "@vercel/blob";

/* ===================== CONSTANTES ===================== */

const COLORS = [
  { value: "CZARNY", label: "czarny" },
  { value: "BIALY", label: "biały" },
  { value: "SZARY", label: "szary" },
  { value: "BEZOWY", label: "beżowy" },
  { value: "BRAZOWY", label: "brązowy" },
  { value: "CZERWONY", label: "czerwony" },
  { value: "ROZOWY", label: "różowy" },
  { value: "ZIELONY", label: "zielony" },
  { value: "NIEBIESKI", label: "niebieski" },
] as const;

const MATERIALS = [
  { value: "BAWELNA", label: "bawełna" },
  { value: "WELNA", label: "wełna" },
  { value: "JEDWAB", label: "jedwab" },
  { value: "LEN", label: "len" },
  { value: "POLIESTER", label: "poliester" },
  { value: "WISKOZA", label: "wiskoza" },
  { value: "SKORA", label: "skóra" },
  { value: "INNE", label: "inne" },
] as const;

/* ===================== FIRMA EMAIL ===================== */

function emailSignature() {
  return `
    <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
    <p style="margin:0; font-size:13px; color:#555;">
      Pozdrawiamy,<br/>
      <strong>Zespół XXXX</strong>
    </p>
    <p style="margin-top:6px; font-size:11px; color:#888;">
      Ta wiadomość została wysłana automatycznie — prosimy na nią nie odpowiadać.
    </p>
  `;
}

/* ===================== PAGE ===================== */

type SearchParams = { error?: string };

export default async function NewListingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/listing/new");

  const sp = (await searchParams) ?? {};
  const errorMsg = sp.error;

  /* ===================== SERVER ACTION ===================== */

  async function createListingAction(formData: FormData) {
    "use server";

    const session = await getSession();
    const userId = session?.user?.id;
    if (!userId) redirect("/login?callbackUrl=/listing/new");

    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();

    const pricePerDay = Number(formData.get("pricePerDay"));
    const fianzaRaw = String(formData.get("fianza") || "").trim();
    const fianza = fianzaRaw === "" ? null : Number(fianzaRaw);

    const city = String(formData.get("city") || "").trim();
    const postalCode = String(formData.get("postalCode") || "").trim();
    const lat = Number(formData.get("lat"));
    const lng = Number(formData.get("lng"));

    const marca = String(formData.get("marca") || "").trim();
    const gender = formData.get("gender") as Gender;
    const garmentType = formData.get("garmentType") as GarmentType;
    const size = String(formData.get("size") || "").trim();
    const color = formData.get("color") as Color;
    const material = String(formData.get("material") || "").trim();

    if (!title) redirect("/listing/new?error=Tytuł jest obowiązkowy");
    if (!Number.isInteger(pricePerDay) || pricePerDay <= 0)
      redirect("/listing/new?error=Cena%20za%20dzień%20nieprawidłowa");

    const listing = await prisma.listing.create({
      data: {
        title,
        description: description || null,
        pricePerDay,
        fianza,
        marca: marca || null,
        city,
        postalCode: postalCode || null,
        country: "PL",
        lat,
        lng,
        gender,
        size,
        color,
        garmentType,
        materials: [material],
        available: true,
        user: { connect: { id: userId } },
      },
      select: { id: true, title: true },
    });

    /* ===== EMAIL ===== */

    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (owner?.email) {
      const baseUrl =
        process.env.VERCEL_ENV === "production"
          ? process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || ""
          : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";

      await sendMail({
        to: owner.email,
        subject: `Ogłoszenie opublikowane: ${listing.title}`,
        html: `
          <p>Cześć ${owner.name ?? ""},</p>

          <p>
            Twoje ogłoszenie <strong>${listing.title}</strong>
            zostało opublikowane.
          </p>

          <p>
            <a href="${baseUrl}/listing/${listing.id}">
              Zobacz ogłoszenie
            </a>
          </p>

          ${emailSignature()}
        `,
      });
    }

    /* ===== ZDJĘCIA ===== */

    const files = formData
      .getAll("photos")
      .filter((x): x is File => x instanceof File);

    let order = 0;

    for (const file of files) {
      if (file.size === 0) continue;

      const ext =
        (file.name.split(".").pop() || "jpg")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "") || "jpg";

      const filename = `${crypto.randomUUID()}.${ext}`;
      const blob = await put(filename, file, { access: "public" });

      await prisma.image.create({
        data: {
          url: blob.url,
          listingId: listing.id,
          order: order++,
        },
      });
    }

    redirect("/listing?ok=1");
  }

  /* ===================== JSX ===================== */

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <form action={createListingAction}>
        {/* FORM CONTENT SIN CAMBIOS */}
      </form>
    </div>
  );
}
