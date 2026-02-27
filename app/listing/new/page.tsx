
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

// ✅ actualizado a tu enum nuevo: +MARYNARKA, -CHAMARRA
const ALLOWED_GARMENT_TYPES: ReadonlySet<GarmentType> = new Set([
  "ABRIGO",
  "CHAQUETA",   // Kurtka (legacy)
  "MARYNARKA",  // Marynarka / blazer
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
  "OTRO",
  "ZAPATO",
]);

const err = (msg: string) => `/listing/new?error=${encodeURIComponent(msg)}`;

/* ===================== FIRMA EMAIL (NUEVO) ===================== */

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

/* ===================== UI helpers ===================== */

const inputBase =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none " +
  "placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

const labelBase = "text-sm font-medium text-gray-800";

const sectionTitle = "text-sm font-semibold text-gray-900";
const sectionHint = "text-xs text-gray-500";

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

    // ✅ Deposit (kaucja / fianza) opcjonalna
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

    /* ===== VALIDACIONES ===== */

    if (!title) redirect(err("Tytuł jest obowiązkowy"));

    if (
      !Number.isFinite(pricePerDay) ||
      !Number.isInteger(pricePerDay) ||
      pricePerDay <= 0
    ) {
      redirect(err("Cena za dzień musi być liczbą całkowitą > 0"));
    }

    if (fianza !== null) {
      if (!Number.isFinite(fianza) || !Number.isInteger(fianza) || fianza < 0) {
        redirect(err("Kaucja musi być liczbą całkowitą ≥ 0"));
      }
    }

    if (!city || Number.isNaN(lat) || Number.isNaN(lng)) {
      redirect(err("Wybierz lokalizację z listy"));
    }

    // ✅ Color (enum Prisma Color)
    const color: Color | null = ALLOWED_COLORS.has(colorRaw as Color)
      ? (colorRaw as Color)
      : null;
    if (!color) redirect(err("Nieprawidłowy kolor"));

    if (
      !ALLOWED_MATERIALS.has(material as (typeof MATERIALS)[number]["value"])
    ) {
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
        fianza, // ✅
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

    /* ===== EMAIL (opcional) ===== */
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (owner?.email) {
      const baseUrl =
        process.env.VERCEL_ENV === "production"
          ? (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "")
          : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";

      try {
        await sendMail({
          to: owner.email,
          subject: `Ogłoszenie opublikowane: ${listing.title}`,
       html: `
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#111; line-height:1.5;">

  <p>Cześć ${owner.name ?? ""},</p>

  <p>Twoje ogłoszenie zostało <strong>opublikowane</strong> i jest już widoczne w serwisie.</p>

  <!-- CARD -->
  <div style="margin:16px 0; padding:16px; border:1px solid #e5e7eb; border-radius:8px; background:#fafafa;">
    <p style="margin:0; font-size:16px; font-weight:600;">
      ${listing.title}
    </p>
  </div>

  <p>
    <a href="${baseUrl}/listing/${listing.id}"
       style="display:inline-block; margin-top:10px; padding:10px 16px;
              background:#111827; color:white; text-decoration:none;
              border-radius:6px; font-weight:600;">
      Zobacz ogłoszenie
    </a>
  </p>

  <div style="margin-top:18px; padding:14px; background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px;">
    <strong>Wskazówka:</strong><br/>
    Dodaj więcej zdjęć i szczegółów w opisie — to zwiększa liczbę rezerwacji.
  </div>

  ${emailSignature()}

</div>
`,
});
      } catch (e) {
        console.error("sendMail failed (ignored):", e);
      }
    }

    /* ===== FOTOS (Vercel Blob) ===== */

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

      <form
        action={createListingAction}
        className="rounded-2xl border bg-white shadow-sm"
      >
        {/* ===== Podstawowe ===== */}
        <div className="p-6 border-b">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={sectionTitle}>Podstawowe informacje</div>
              <div className={sectionHint}>Tytuł i opis ogłoszenia.</div>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className={labelBase} htmlFor="title">
                Tytuł
              </label>
              <input
                id="title"
                name="title"
                placeholder="Np. Kurtka Mango, rozmiar 46"
                required
                className={`${inputBase} mt-1`}
              />
            </div>

            <div>
              <label className={labelBase} htmlFor="description">
                Opis
              </label>
              <textarea
                id="description"
                name="description"
                placeholder="Napisz kilka zdań: stan, krój, okazja, wymiary..."
                className={`${inputBase} mt-1 min-h-[120px] resize-y`}
              />
            </div>
          </div>
        </div>

        {/* ===== Ceny ===== */}
        <div className="p-6 border-b">
          <div className={sectionTitle}>Cennik</div>
          <div className={sectionHint}>
            Cena za dzień jest obowiązkowa, kaucja opcjonalna.
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelBase} htmlFor="pricePerDay">
                Cena za dzień (zł)
              </label>
              <input
                id="pricePerDay"
                name="pricePerDay"
                type="number"
                min={1}
                step={1}
                required
                placeholder="Np. 50"
                className={`${inputBase} mt-1`}
              />
            </div>

            <div>
              <label className={labelBase} htmlFor="fianza">
                Kaucja (zł)
              </label>
              <input
                id="fianza"
                name="fianza"
                type="number"
                min={0}
                step={1}
                placeholder="Np. 30 (opcjonalnie)"
                className={`${inputBase} mt-1`}
              />
            </div>
          </div>
        </div>

        {/* ===== Lokalizacja ===== */}
        <div className="p-6 border-b">
          <div className={sectionTitle}>Lokalizacja</div>
          <div className={sectionHint}>
            Wybierz miasto lub kod pocztowy w Polsce.
          </div>

          <div className="mt-4">
            <LocationField />
          </div>
        </div>

        {/* ===== Szczegóły ===== */}
        <div className="p-6 border-b">
          <div className={sectionTitle}>Szczegóły produktu</div>
          <div className={sectionHint}>
            Ułatw użytkownikom znalezienie ogłoszenia.
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelBase} htmlFor="marca">
                Marka
              </label>
              <input
                id="marca"
                name="marca"
                placeholder="Np. Mango"
                className={`${inputBase} mt-1`}
              />
            </div>

            <div>
              <label className={labelBase} htmlFor="gender">
                Płeć
              </label>
              <select
                id="gender"
                name="gender"
                required
                className={`${inputBase} mt-1`}
              >
                <option value="">Wybierz</option>
                <option value="WOMAN">Kobieta</option>
                <option value="MAN">Mężczyzna</option>
                <option value="UNISEX">Unisex</option>
                <option value="KIDS">Dziecko</option>
              </select>
            </div>

            <div>
              <label className={labelBase} htmlFor="size">
                Rozmiar
              </label>
              <select
                id="size"
                name="size"
                required
                className={`${inputBase} mt-1`}
              >
                <option value="">Wybierz</option>
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
            </div>

            <div>
              <label className={labelBase} htmlFor="color">
                Kolor
              </label>
              <select
                id="color"
                name="color"
                required
                className={`${inputBase} mt-1`}
              >
                <option value="">Wybierz</option>
                {COLORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className={labelBase} htmlFor="garmentType">
                Typ ubrania
              </label>
              <select
                id="garmentType"
                name="garmentType"
                required
                className={`${inputBase} mt-1`}
              >
                <option value="">Wybierz</option>
                <option value="TRAJE">Garnitur</option>
                <option value="VESTIDO">Sukienka</option>
                <option value="MARYNARKA">Marynarka</option>
                <option value="CAMISA">Koszula</option>
                <option value="BLUSA">Bluzka</option>
                <option value="PANTALON">Spodnie</option>
                <option value="FALDA">Spódnica</option>

                <option value="ABRIGO">Płaszcz</option>
                <option value="CHAQUETA">Kurtka</option>

                <option value="SUDADERA">Bluza</option>
                <option value="JERSEY">Sweter</option>
                <option value="MONO">Kombinezon</option>

                <option value="ACCESORIO">Akcesoria</option>
                <option value="ZAPATO">Buty</option>
                <option value="OTRO">Inne</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className={labelBase} htmlFor="material">
                Materiał główny
              </label>
              <select
                id="material"
                name="material"
                required
                className={`${inputBase} mt-1`}
              >
                <option value="">Wybierz</option>
                {MATERIALS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ===== Zdjęcia + submit ===== */}
        <div className="p-6">
          <div className={sectionTitle}>Zdjęcia</div>
          <div className={sectionHint}>
            Dodaj kilka wyraźnych zdjęć (min. 1). Najlepiej w pionie.
          </div>

          <div className="mt-4 flex flex-col md:flex-row md:items-center gap-4">
            <label className="flex-1">
              <span className="sr-only">Dodaj zdjęcia</span>
              <input
                type="file"
                name="photos"
                multiple
                required
                className="block w-full text-sm text-gray-700
                           file:mr-4 file:rounded-lg file:border-0
                           file:bg-gray-100 file:px-4 file:py-2
                           file:text-sm file:font-semibold file:text-gray-700
                           hover:file:bg-gray-200"
              />
            </label>

            <button
              className="w-full md:w-auto rounded-lg bg-indigo-600 px-6 py-2.5 text-white font-semibold
                         hover:bg-indigo-700 active:bg-indigo-800 transition"
              type="submit"
            >
              Opublikuj
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
