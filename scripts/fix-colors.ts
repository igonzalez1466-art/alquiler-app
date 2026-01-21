import { PrismaClient, Color } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Convierte colores antiguos (texto libre) a enums válidos (Prisma Color)
 */
const COLOR_MAP: Record<string, Color> = {
  czarny: "CZARNY",
  "biały": "BIALY",
  bialy: "BIALY",
  szary: "SZARY",
  "beżowy": "BEZOWY",
  bezowy: "BEZOWY",
  "brązowy": "BRAZOWY",
  brazowy: "BRAZOWY",
  czerwony: "CZERWONY",
  "różowy": "ROZOWY",
  rozowy: "ROZOWY",
  "pomarańczowy": "POMARANCZOWY",
  pomaranczowy: "POMARANCZOWY",
  "żółty": "ZOLTY",
  zolty: "ZOLTY",
  zielony: "ZIELONY",
  niebieski: "NIEBIESKI",
  granatowy: "GRANATOWY",
  fioletowy: "FIOLETOWY",
  "złoty": "ZLOTY",
  zloty: "ZLOTY",
  srebrny: "SREBRNY",
  wielokolorowy: "WIELOKOLOROWY",
};

// ✅ lista de enums válidos
const VALID_COLORS = Object.values(Color) as Color[];

// ✅ lista de colores “destino” que tu mapa puede producir
const MAPPED_COLORS = Object.values(COLOR_MAP) as Color[];

function normalize(s: string) {
  return s.trim().toLowerCase();
}

async function main() {
  /**
   * Si tu columna `color` es enum, Prisma solo te dejaría guardar valores del enum.
   * Pero por migraciones antiguas puede haber valores “raros” en la DB.
   * Este findMany intenta detectar cosas fuera del conjunto “mapeado”.
   */
  const listings = await prisma.listing.findMany({
    where: {
      // ✅ Prisma espera Color[] aquí, no string[]
      color: {
        notIn: MAPPED_COLORS,
      },
    },
    select: {
      id: true,
      color: true,
    },
  });

  let fixed = 0;

  for (const l of listings) {
    // `l.color` (si Prisma lo lee) será Color | null
    const current = l.color;

    if (!current) {
      console.log(`⏭️  Skipped ${l.id} (color: null)`);
      continue;
    }

    // Caso A: ya es un enum válido pero “no está en tu mapa”
    // (por ejemplo, SREBRNY existe y quizá no lo tenías en el mapa antes, etc.)
    if (VALID_COLORS.includes(current)) {
      console.log(`⏭️  OK enum ${l.id} (color: ${current})`);
      continue;
    }

    // Caso B: si por alguna razón llega algo no-enum (migración sucia),
    // lo normalizamos y lo intentamos mapear.
    const raw = normalize(String(current));
    const mapped = COLOR_MAP[raw] ?? null;

    if (!mapped) {
      console.log(`⏭️  Skipped ${l.id} (unmapped color: ${String(current)})`);
      continue;
    }

    await prisma.listing.update({
      where: { id: l.id },
      data: { color: mapped }, // ✅ Color (enum)
    });

    fixed++;
    console.log(`✅ Fixed ${l.id}: ${String(current)} -> ${mapped}`);
  }

  console.log(`✅ Fixed colors total: ${fixed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
