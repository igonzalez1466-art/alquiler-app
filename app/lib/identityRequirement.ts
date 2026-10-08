import { prisma } from "@/app/lib/prisma";
import { publicIdentityVerified } from "@/app/lib/identityVerification";

export const IDENTITY_REQUIRED_MESSAGE = "Przed publikacją ogłoszenia lub rezerwacją zweryfikuj tożsamość w sekcji „Moje konto”.";
export const OWNER_IDENTITY_REQUIRED_MESSAGE = "Właściciel musi zweryfikować tożsamość, zanim będzie można zarezerwować ten przedmiot lub opłacić rezerwację.";
export const requiredIdentitySelect = { identityStatus: true, identityVerifiedAt: true, identityLivemode: true } as const;
type Identity = { identityStatus?: string; identityVerifiedAt?: Date | null; identityLivemode?: boolean | null };

export function hasRequiredIdentity(user: Identity | null | undefined) {
  if (!user) return false;
  if (publicIdentityVerified(user)) return true;
  // Simulated verification is accepted only on the explicitly configured staging site.
  let staging = false;
  try { const url = new URL(process.env.APP_URL ?? ""); staging = url.protocol === "https:" && url.hostname === "stagingmojaszafa.eu"; } catch { /* Fail closed. */ }
  return staging && process.env.STRIPE_IDENTITY_MODE === "test" && user.identityStatus === "verified" && user.identityLivemode === false && !!user.identityVerifiedAt;
}
export async function getRequiredIdentity(userId: string) {
  return hasRequiredIdentity(await prisma.user.findUnique({ where: { id: userId }, select: requiredIdentitySelect }));
}
export function safeIdentityReturn(value: unknown) {
  return typeof value === "string" && /^\/(?:listing\/(?:new|[A-Za-z0-9_-]+)|bookings\/[A-Za-z0-9_-]+(?:\/pay)?)$/.test(value) ? value : null;
}
export function accountIdentityUrl(returnTo: string) {
  const safe = safeIdentityReturn(returnTo);
  return "/account" + (safe ? "?returnTo=" + encodeURIComponent(safe) : "") + "#tozsamosc";
}
