"use server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";

export async function restrictIncidentAccount(data: FormData) {
  const session = await getSession();
  const admin = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } }) : null;
  if (admin?.role !== "ADMIN") throw new Error("Brak dostępu.");
  const incidentId = String(data.get("incidentId"));
  const note = String(data.get("note") ?? "").trim();
  if (!note || note.length > 2000) throw new Error("Podaj uzasadnienie od 1 do 2000 znaków.");
  const operation = String(data.get("operation"));
  if (!["restrict", "restore"].includes(operation)) throw new Error("Nieprawidłowa operacja.");
  await prisma.$transaction(async tx => {
    const inc = await tx.incident.findUniqueOrThrow({ where: { id: incidentId } });
    await tx.user.update({ where: { id: inc.againstUserId }, data: { bookingRestrictedAt: operation === "restrict" ? new Date() : null, bookingRestrictionReason: operation === "restrict" ? note : null } });
    await tx.incidentEvidence.create({ data: { incidentId, uploaderId: session!.user!.id!, text: `Obsługa — ${operation === "restrict" ? "ograniczenie nowych rezerwacji" : "przywrócenie rezerwacji"}: ${note}` } });
  });
  revalidatePath("/admin/incidents");
  revalidatePath("/account");
}
