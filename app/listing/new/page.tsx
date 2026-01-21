// app/listing/new/page.tsx
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import LocationField from "./LocationField";
import { sendMail } from "@/app/lib/mailer";
import type { Gender, GarmentType, Color } from "@prisma/client";

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

// ✅ Prisma enums (validación sin any)
const ALLOWED_COLORS: ReadonlySet<Color> = new Set([
  "CZARNY",
  "BIALY",
  "SZARY",
  "BEZOWY",
  "BRAZOWY",
  "CZERWONY",
  "ROZOWY",
  "ZIELONY",
  "NIEBIESKI",
]);

const ALLOWED_MATERIALS = new Set(MATERIALS.map((m) => m.value));

const ALLOWED_GENDERS: ReadonlySet<Gender> = new Set([
  "WOMAN",
  "MAN",
  "UNISEX",
  "KIDS",
]);

const ALLOWED_GARMENT_TYPES: ReadonlySet<GarmentType> = new Set([
  "ABRIGO",
  "CHAQUETA",
  "CAMISA",
  "BLUSA",
  "VESTIDO",
  "PANTALON",
  "FALDA",
  "TRAJE",
  "SUDADERA",
  "JERSEY",
  "MONO",
  "ACCESORIO",
  "CHAMARRA",
  "OTRO",
  "ZAPATO",
]);

const err = (msg: string) => `/listing/new?error=${encodeURIComponent(msg)}`;

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

    /* ===== VALIDACIONES ===== */

    if (!title) redirect(err("Tytuł jest obowiązkowy"));

    if (
      !Number.isFinite(pricePerDay) ||
      !Number.isInteger(pricePerDay) ||
      pricePerDay <= 0
    ) {
      redirect(err("Cena za dzień musi być liczbą całkowitą > 0"));
    }

    if (!city || Number.isNaN(lat) || Number.isNaN(lng)) {
      redirect(err("Wybierz lokalizację z listy"));
    }

    // ✅ Color (enum Prisma Color)
    const color: Color | null = ALLOWED_COLORS.has(colorRaw as Color)
      ? (colorRaw as Color)
      : null;
    if (!color) redirect(err("Nieprawidłowy kolor"));

    if (!ALLOWED_MATERIALS.has(material as (typeof MATERIALS)[number]["value"])) {
      redirect(err("Nieprawidłowy materiał"));
    }

    const gender: Gender | null = ALLOWED_GENDERS.has(genderRaw as Gender)
      ? (genderRaw as Gender)
      : null;

    const garmentType: GarmentType | null = ALLOWED_GARMENT_TYPES.has(
      garmentTypeRaw as GarmentType
    )
      ? (garmentTypeRaw as GarmentType)
      : null;

    if (!gender) redirect(err("Nieprawidłowa płeć"));
    if (!garmentType) redirect(err("Nieprawidłowy typ ubrania"));

    if (!size) redirect(err("Rozmiar jest obowiązkowy"));

    /* ===== CREAR LISTING ===== */

    const listing = await prisma.listing.create({
      data: {
        title,
        description: description || null,
        pricePerDay,
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

    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (owner?.email) {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

      try {
        await sendMail({
          to: owner.email,
          subject: `Ogłoszenie opublikowane: ${listing.title}`,
          html: `
            <p>Cześć ${owner.name ?? ""},</p>
            <p>Twoje ogłoszenie <strong>${listing.title}</strong> zostało opublikowane.</p>
            <p><a href="${baseUrl}/listing/${listing.id}">Zobacz ogłoszenie</a></p>
          `,
        });
      } catch (e) {
        console.error("sendMail failed (ignored):", e);
      }
    }

    /* ===== FOTOS ===== */

    const files = formData
      .getAll("photos")
      .filter((x): x is File => x instanceof File);

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    let order = 0;
    for (const file of files) {
      if (file.size === 0) continue;

      const filename = `${crypto.randomUUID()}.jpg`;

      await fs.writeFile(
        path.join(uploadDir, filename),
        Buffer.from(await file.arrayBuffer())
      );

      await prisma.image.create({
        data: {
          url: `/uploads/${filename}`,
          listingId: listing.id,
          order: order++,
        },
      });
    }

    redirect("/listing?ok=1");
  }

  /* ===================== JSX ===================== */

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <h1 className="text-xl font-bold mb-4">Nowe ogłoszenie</h1>

      {errorMsg && (
        <div className="mb-4 bg-red-50 border border-red-200 p-2 text-red-700">
          {errorMsg}
        </div>
      )}

      <form action={createListingAction} className="space-y-4">
        <input
          name="title"
          placeholder="Tytuł"
          required
          className="border p-2 w-full"
        />

        <textarea
          name="description"
          placeholder="Opis"
          className="border p-2 w-full"
        />

        <input
          name="pricePerDay"
          type="number"
          min={1}
          step={1}
          required
          placeholder="Cena za dzień (PLN)"
          className="border p-2 w-full"
        />

        <LocationField />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input name="marca" placeholder="Marka" className="border p-2" />

          <select name="gender" required className="border p-2">
            <option value="">Płeć</option>
            <option value="WOMAN">Kobieta</option>
            <option value="MAN">Mężczyzna</option>
            <option value="UNISEX">Unisex</option>
            <option value="KIDS">Dziecko</option>
          </select>

          <select name="size" required className="border p-2">
            <option value="">Rozmiar</option>
            <option>XS</option>
            <option>S</option>
            <option>M</option>
            <option>L</option>
            <option>XL</option>
            <option>XXL</option>
            <option>34</option>
            <option>36</option>
            <option>38</option>
            <option>40</option>
            <option>42</option>
            <option>44</option>
            <option>46</option>
            <option>48</option>
          </select>

          <select name="color" required className="border p-2">
            <option value="">Kolor</option>
            {COLORS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select name="garmentType" required className="border p-2">
            <option value="">Typ ubrania</option>
            <option value="ABRIGO">Płaszcz</option>
            <option value="CHAQUETA">Marynarka</option>
            <option value="CAMISA">Koszula</option>
            <option value="BLUSA">Bluzka</option>
            <option value="VESTIDO">Sukienka</option>
            <option value="PANTALON">Spodnie</option>
            <option value="FALDA">Spódnica</option>
            <option value="TRAJE">Garnitur</option>
            <option value="SUDADERA">Bluza</option>
            <option value="JERSEY">Sweter</option>
            <option value="MONO">Kombinezon</option>
            <option value="CHAMARRA">Kurtka</option>
            <option value="ACCESORIO">Akcesoria</option>
            <option value="ZAPATO">Buty</option>
            <option value="OTRO">Inne</option>
          </select>

          <select name="material" required className="border p-2 md:col-span-2">
            <option value="">Materiał główny</option>
            {MATERIALS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <input type="file" name="photos" multiple required />

        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Opublikuj
        </button>
      </form>
    </div>
  );
}
