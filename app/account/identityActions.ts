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
  } catch (error) {
    // Log only allowlisted diagnostic identifiers, never the error or its message.
    const failure = error as { type?: string; name?: string; code?: string; statusCode?: number } | null;
    const allowedTypes = ["StripeAuthenticationError", "StripePermissionError", "StripeInvalidRequestError", "StripeConnectionError", "StripeAPIError", "StripeRateLimitError", "PrismaClientKnownRequestError", "PrismaClientInitializationError", "PrismaClientValidationError"];
    const candidateType = failure?.type ?? failure?.name;
    const allowedCodes = ["api_key_expired", "invalid_api_key", "permission_denied", "resource_missing", "parameter_unknown", "parameter_invalid_empty", "P1001", "P1002", "P2021", "P2022", "P2024", "P2028", "P2010"];
    console.error("[Stripe Identity] action failed", {
      operation,
      type: candidateType && allowedTypes.includes(candidateType) ? candidateType : "unknown",
      code: failure?.code && allowedCodes.includes(failure.code) ? failure.code : "unknown",
      status: [400, 401, 403, 404, 409, 429, 500, 502, 503, 504].includes(failure?.statusCode ?? 0) ? failure?.statusCode : null,
    });
    return { ok: false as const, message: "Nie udało się sprawdzić weryfikacji. Spróbuj ponownie za chwilę." };
  }
}
