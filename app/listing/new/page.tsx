import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { redirect } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import LocationField from "./LocationField";
import { sendMail } from "@/app/lib/mailer";

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

const ALLOWED_COLORS = new Set(COLORS.map(c => c.value));
const ALLOWED_MATERIALS = new Set(MATERIALS.map(m => m.value));

const err = (msg: string) =>
  `/listing/new?error=${encodeURIComponent(msg)}`;

/* ===================== PAGE ===================== */

type SearchParams = { error?: string };

export default async function NewListingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getServerSession(authConfig);
  if (!session?.user) redirect("/login?callbackUrl=/listing/new");

  const sp = (await searchParams) ?? {};
  const errorMsg = sp.error;

  /* ===================== SERVER ACTION ===================== */

  async function createListing(formData: FormData) {
    "use server";

    const session = await getServerSession(authConfig);
    const userId = (session?.user as any)?.id;
    if (!userId) redirect("/login?callbackUrl=/listing/new");

    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();

    const city = String(formData.get("city") || "").trim();
    const postalCode = String(formData.get("postalCode") || "").trim();
    const lat = Number(formData.get("lat"));
    const lng = Number(formData.get("lng"));

    const marca = String(formData.get("marca") || "").trim();
    const gender = String(formData.get("gender") || "");
    const size = String(formData.get("size") || "");
    const color = String(formData.get("color") || "");
    const garmentType = String(formData.get("garmentType") || "");
    const material = String(formData.get("material") || "");

    /* ===== VALIDACIONES ===== */

    if (!title) redirect(err("Tytuł jest obowiązkowy"));

    if (!city || Number.isNaN(lat) || Number.isNaN(lng)) {
      redirect(err("Wybierz lokalizację z listy"));
    }

    if (!ALLOWED_COLORS.has(color))
      redirect(err("Nieprawidłowy kolor"));

    if (!ALLOWED_MATERIALS.has(material))
      redirect(err("Nieprawidłowy materiał"));

    /* ===== CREAR LISTING ===== */

    const listing = await prisma.listing.create({
      data: {
        title,
        description: description || null,
        pricePerDay: 0,
        userId,
        marca: marca || null,
        city,
        postalCode: postalCode || null,
        country: "PL",
        lat,
        lng,
        gender: gender as any,
        size,
        color,
        garmentType: garmentType as any,
        materials: [material],
      },
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
    // ✅ NO hacemos throw, no interrumpimos el flujo
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
      if (!file || file.size === 0) continue;

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

      <form action={createListing} className="space-y-4">
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

        <LocationField />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            name="marca"
            placeholder="Marka"
            className="border p-2"
          />

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
            {COLORS.map(c => (
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
          </select>

          <select
            name="material"
            required
            className="border p-2 md:col-span-2"
          >
            <option value="">Materiał główny</option>
            {MATERIALS.map(m => (
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
