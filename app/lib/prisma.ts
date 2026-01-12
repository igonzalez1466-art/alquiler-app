/*app/lib/prisma.ts*/
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  sqliteInited?: boolean;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"] // 👈 NO uses "query" en dev con SQLite (puede causar lentitud/locks)
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Inicializa PRAGMAs útiles para SQLite (solo una vez).
 * - WAL mejora concurrencia
 * - busy_timeout hace que espere antes de fallar por lock/timeout
 */
export async function initSqlitePragmas() {
  if (globalForPrisma.sqliteInited) return;
  globalForPrisma.sqliteInited = true;

  try {
    await prisma.$executeRawUnsafe(`PRAGMA journal_mode = WAL;`);
    await prisma.$executeRawUnsafe(`PRAGMA busy_timeout = 5000;`);
  } catch (e) {
    console.warn("[SQLITE] PRAGMA init failed:", e);
  }
}
