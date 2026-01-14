import { NextResponse } from 'next/server';
import { prisma } from '@lib/prisma';
import { Estado, MetodoEnvio } from '@prisma/client';
import { z } from 'zod';

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
    const body = await req.json();

    // 👉 valida el body
    const data = listingSchema.parse(body);

    const listing = await prisma.listing.create({
      data: {
        ...data,
        userId: body.userId, 
        // ⚠️ lo ideal sería usar el userId desde la sesión/auth
      },
    });

    return NextResponse.json(listing);
  } catch (err) {
    // Si el error viene de Zod, devolvemos 400 con detalle
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: err.errors },
        { status: 400 }
      );
    }

    console.error(err);
    return NextResponse.json(
      { error: 'Error al crear anuncio' },
      { status: 500 }
    );
  }
}
