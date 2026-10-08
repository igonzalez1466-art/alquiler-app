import { MINIMUM_RENTAL_DAYS, MAXIMUM_RENTAL_DAYS } from "@/app/lib/minimumRentalDays";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { Estado, Gender, MetodoEnvio, GarmentType } from "@prisma/client";
import { isSportCode, isAccessoryCode, validateOtherListingFields } from "@/app/lib/listingAttributes";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";
import { DEPOSITS_ENABLED } from "@/app/lib/features";

export const dynamic = "force-dynamic";

// ✅ Validación del body con Zod
const listingSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  pricePerDay: z.coerce.number().int().positive(),
  minimumRentalDays: z.coerce.number().int().min(MINIMUM_RENTAL_DAYS).max(MAXIMUM_RENTAL_DAYS).default(MINIMUM_RENTAL_DAYS),
  city: z.string().optional(),
  estado: z.nativeEnum(Estado),
  fianza: z.coerce.number().int().min(0).optional(),
  metodoEnvio: z.nativeEnum(MetodoEnvio),
  gender: z.nativeEnum(Gender).optional(),
  garmentType: z.nativeEnum(GarmentType).optional(),
  accessoryType: z.string().refine(isAccessoryCode, "Wybierz rodzaj akcesorium").optional(),
  sport: z.string().refine(isSportCode, "Wybierz sport").optional(),
  otherGarmentType: z.string().optional(),
  otherAccessoryType: z.string().optional(),
  otherSport: z.string().optional(),
  pregnancy: z.boolean().optional().default(false),
}).superRefine((data, context) => {
  const otherFields = validateOtherListingFields(data);
  if ("error" in otherFields) context.addIssue({ code: "custom", path: [otherFields.field], message: otherFields.error });
  if (data.garmentType === "ACCESORIO" && !data.accessoryType) context.addIssue({ code: "custom", path: ["accessoryType"], message: "Wybierz rodzaj akcesorium." });
  if (data.garmentType !== "ACCESORIO" && data.accessoryType) context.addIssue({ code: "custom", path: ["accessoryType"], message: "Rodzaj akcesorium wymaga kategorii Akcesoria." });
  if (data.pregnancy && data.gender !== "WOMAN") {
    context.addIssue({ code: "custom", path: ["pregnancy"], message: "Odzież ciążowa jest dostępna tylko dla kategorii Kobieta." });
  }
});

export async function POST(req: Request) {
  try {
    const session = (await getServerSession(authConfig)) as Session | null;
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Brak uprawnień." }, { status: 401 });
    }

    const body = await req.json();

    // 👉 valida el body
    const data = listingSchema.parse(body);
    const otherFields = validateOtherListingFields(data);
    if ("error" in otherFields) return NextResponse.json({ error: otherFields.error }, { status: 400 });

    const listing = await prisma.listing.create({
      data: {
        ...data,
        ...otherFields.values,
        fianza: DEPOSITS_ENABLED ? data.fianza : null,
        userId, // ✅ desde sesión, no desde body
      },
    });

    return NextResponse.json(listing);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Nieprawidłowe dane.", issues: err.issues.map(issue => ({ ...issue, message: issue.code === "custom" ? issue.message : "Sprawdź wartość w tym polu." })) },
        { status: 400 }
      );
    }

    console.error(err);
    return NextResponse.json(
      { error: "Nie udało się utworzyć ogłoszenia." },
      { status: 500 }
    );
  }
}
