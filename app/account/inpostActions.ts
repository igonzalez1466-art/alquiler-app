"use server";

import { getSession } from "@/app/lib/auth";
import { readInpostPoint } from "@/app/lib/inpostPoint";
import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";

export async function savePreferredInpostPointAction(formData: FormData) {
  const userId = (await getSession())?.user?.id;
  if (!userId) throw new Error("Zaloguj się, aby zapisać punkt InPost.");

  const rawCode = String(formData.get("pointCode") ?? "").trim();
  const rawAddress = String(formData.get("pointAddress") ?? "").trim();
  if (!rawCode && rawAddress) throw new Error("Podaj kod punktu InPost.");

  const point = rawCode ? readInpostPoint(formData) : null;
  await prisma.user.update({
    where: { id: userId },
    data: {
      preferredInpostPointCode: point?.code ?? null,
      preferredInpostPointAddress: point?.address ?? null,
    },
  });

  revalidatePath("/account");
}
