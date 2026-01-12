import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Convierte colores antiguos (texto libre) a enums válidos
 */
const COLOR_MAP: Record<string, string> = {
  czarny: "CZARNY",
  biały: "BIALY",
  bialy: "BIALY",
  szary: "SZARY",
  beżowy: "BEZOWY",
  bezowy: "BEZOWY",
  brązowy: "BRAZOWY",
  brazowy: "BRAZOWY",
  czerwony: "CZERWONY",
  różowy: "ROZOWY",
  rozowy: "ROZOWY",
  pomarańczowy: "POMARANCZOWY",
  pomaranczowy: "POMARANCZOWY",
  żółty: "ZOLTY",
  zolty: "ZOLTY",
  zielony: "ZIELONY",
  niebieski: "NIEBIESKI",
  granatowy: "GRANATOWY",
  fioletowy: "FIOLETOWY",
  złoty: "ZLOTY",
  zloty: "ZLOTY",
  srebrny: "SREBRNY",
  wielokolorowy: "WIELOKOLOROWY",
};

async function main() {
  const listings = await prisma.listing.findMany({
    where: {
      color: {
        notIn: Object.values(COLOR_MAP),
      },
    },
    select: {
      id: true,
      color: true,
    },
  });

  let fixed = 0;

  for (const l of listings) {
    const raw = l.color?.toLowerCase().trim();
    const mapped = raw ? COLOR_MAP[raw] : null;

    if (!mapped) {
      console.log(`⏭️  Skipped ${l.id} (color: ${l.color})`);
      continue;
    }

    await prisma.listing.update({
      where: { id: l.id },
      data: { color: mapped },
    });

    fixed++;
  }

  console.log(`✅ Fixed colors: ${fixed}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
