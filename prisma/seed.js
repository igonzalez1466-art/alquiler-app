// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Creando datos de prueba...");

  // Crear usuarios
  const passwordHash = await bcrypt.hash("password123", 10);

  const seller = await prisma.user.create({
    data: {
      email: "seller@example.com",
      name: "Vendedor",
      passwordHash,
    },
  });

  const buyer = await prisma.user.create({
    data: {
      email: "buyer@example.com",
      name: "Comprador",
      passwordHash,
    },
  });

  // Crear un anuncio del seller
  const listing = await prisma.listing.create({
    data: {
      title: "Bici de paseo",
      description: "Bicicleta cómoda para ciudad.",
      pricePerDay: 12,
      city: "Madrid",
      userId: seller.id,
      estado: "USADO",
      metodoEnvio: "RECOGIDA_LOCAL",
      available: true,
    },
  });

  // Crear una conversación buyer ↔ seller
  const conversation = await prisma.conversation.create({
    data: {
      listingId: listing.id,
      buyerId: buyer.id,
      sellerId: seller.id,
    },
  });

  // Crear un primer mensaje
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: buyer.id,
      text: "¡Hola! ¿Está disponible para este finde?",
    },
  });

  console.log("✅ Seed completado.");
  console.log("Credenciales de prueba:");
  console.log("  Seller -> seller@example.com / password123");
  console.log("  Buyer  -> buyer@example.com  / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
