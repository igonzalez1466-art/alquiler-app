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

    const pricePerDayRaw = String(formData.get("pricePerDay") || "").trim();
    const pricePerDay = Number(pricePerDayRaw);

    const fianzaRaw = String(formData.get("fianza") || "").trim();
    const fianza = fianzaRaw === "" ? null : Number(fianzaRaw);

    const city = String(formData.get("city") || "").trim();
    const postalCode = String(formData.get("postalCode") || "").trim();
    const lat = Number(formData.get("lat"));
    const lng = Number(formData.get("lng"));

    const marca = String(formData.get("marca") || "").trim();
    const genderRaw = String(formData.get("gender") || "").trim();
    const garmentTypeRaw = String(formData.get("garmentType") || "").trim();
    const size = String(formData.get("size") || "").trim();
    const colorRaw = String(formData.get("color") || "").trim();
    const material = String(formData.get("material") || "").trim();

    if (!title) redirect("/listing/new?error=Tytuł%20jest%20obowiązkowy");
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
        gender: genderRaw as Gender,
        size,
        color: colorRaw as Color,
        garmentType: garmentTypeRaw as GarmentType,
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nowe ogłoszenie</h1>
        <p className="text-sm text-gray-500">
          Uzupełnij dane ogłoszenia i dodaj zdjęcia.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <form action={createListingAction} className="rounded-2xl border bg-white shadow-sm">
        {/* ===== Podstawowe ===== */}
        <div className="p-6 border-b">
          <label className="block text-sm font-medium text-gray-800">
            Tytuł
          </label>
          <input
            name="title"
            required
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </div>

        {/* ===== Lokalizacja ===== */}
        <div className="p-6 border-b">
          <LocationField />
        </div>

        {/* ===== Zdjęcia + submit ===== */}
        <div className="p-6">
          <input type="file" name="photos" multiple required />
          <button
            type="submit"
            className="mt-4 rounded-lg bg-indigo-600 px-6 py-2 text-white"
          >
            Opublikuj
          </button>
        </div>
      </form>
    </div>
  );
}
