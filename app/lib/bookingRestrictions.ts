import { prisma } from "./prisma";

export async function assertBookingAccountsAvailable(...ids: string[]) {
  if (await prisma.user.findFirst({ where: { id: { in: ids }, bookingRestrictedAt: { not: null } }, select: { id: true } })) {
    throw new Error("Nowe rezerwacje na tym koncie zostały ograniczone. Skontaktuj się z obsługą serwisu.");
  }
}
