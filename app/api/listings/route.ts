import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { Estado, Gender, MetodoEnvio } from "@prisma/client";
import { isSportCode } from "@/app/lib/listingAttributes";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";

export const dynamic = "force-dynamic";

// ✅ Validación del body con Zod
const listingSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  pricePerDay: z.coerce.number().int().positive(),
  city: z.string().optional(),
  estado: z.nativeEnum(Estado),
  fianza: z.coerce.number().int().min(0).optional(),
  metodoEnvio: z.nativeEnum(MetodoEnvio),
  gender: z.nativeEnum(Gender).optional(),
  sport: z.string().refine(isSportCode, "Wybierz sport").optional(),
  pregnancy: z.boolean().optional().default(false),
}).superRefine((data, context) => {
  if (data.pregnancy && data.gender !== "WOMAN") {
    context.addIssue({ code: "custom", path: ["pregnancy"], message: "Odzież ciążowa jest dostępna tylko dla kategorii Kobieta." });
  }
});

export async function POST(req: Request) {
  try {
    const session = (await getServerSession(authConfig)) as Session | null;
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();

    // 👉 valida el body
    const data = listingSchema.parse(body);

    const listing = await prisma.listing.create({
      data: {
        ...data,
        userId, // ✅ desde sesión, no desde body
      },
    });

    return NextResponse.json(listing);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: err.issues },
        { status: 400 }
      );
    }

    console.error(err);
    return NextResponse.json(
      { error: "Error al crear anuncio" },
      { status: 500 }
    );
  }
}
