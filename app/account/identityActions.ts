"use server";
import { getSession } from "@/app/lib/auth";
import { beginIdentity, syncIdentity } from "@/app/lib/identityVerification";
import { revalidatePath } from "next/cache";

export async function identityAction(operation: "start" | "refresh") {
  const userId = (await getSession())?.user?.id;
  if (!userId) return { ok: false as const, message: "Zaloguj się, aby zweryfikować tożsamość." };
  if (!["start", "refresh"].includes(operation)) return { ok: false as const, message: "Nieprawidłowa operacja." };
  try {
    const result = operation === "start" ? await beginIdentity(userId) : { ...await syncIdentity(userId), url: null };
    revalidatePath("/account");
    revalidatePath(`/users/${userId}`);
    return { ok: true as const, ...result };
  } catch {
    // Stripe errors can include personal information; never return or log them.
    return { ok: false as const, message: "Nie udało się sprawdzić weryfikacji. Spróbuj ponownie za chwilę." };
  }
}
