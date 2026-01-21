import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { Estado, MetodoEnvio } from "@prisma/client";
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
