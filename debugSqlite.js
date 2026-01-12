const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugSqlite() {
  console.log('DATABASE_URL=', process.env.DATABASE_URL);
  console.log('CWD=', process.cwd());

  const dbList = await prisma.$queryRawUnsafe(`PRAGMA database_list;`);
  console.log('PRAGMA database_list:', dbList);

  const tables = await prisma.$queryRawUnsafe(`
    SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
  `);
  console.log('Tablas:', tables);

  await prisma.$disconnect();
}

debugSqlite().catch(console.error);
