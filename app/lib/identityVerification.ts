import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";

function identityError(code: string, message: string) {
  return Object.assign(new Error(message), { name: "IdentityValidationError", code });
}

export function identityConfig() {
  const key = process.env.STRIPE_IDENTITY_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  const live = process.env.STRIPE_IDENTITY_MODE === "live";
  const matching = !!key && (live ? /^(sk|rk)_live_/.test(key) : /^(sk|rk)_test_/.test(key));
  return { key, live, enabled: process.env.STRIPE_IDENTITY_ENABLED === "true" && matching };
}
export function identityStripe() {
  const config = identityConfig();
  if (!config.key || !(config.live ? /^(sk|rk)_live_/.test(config.key) : /^(sk|rk)_test_/.test(config.key))) throw identityError("identity_key_mode", "Weryfikacja tożsamości jest chwilowo niedostępna.");
  return new Stripe(config.key, { apiVersion: "2025-09-30.clover", timeout: 10000, maxNetworkRetries: 0 });
}
export const identitySelect = { id: true, identitySessionId: true, identityStatus: true, identityVerifiedAt: true, identityLivemode: true, identityAttempt: true, identityStartedAt: true } as const;
export function publicIdentityVerified(user: { identityStatus?: string; identityLivemode?: boolean | null; identityVerifiedAt?: Date | null }) {
  return user.identityStatus === "verified" && user.identityLivemode === true && !!user.identityVerifiedAt;
}
export function identityView(user: { identityStatus: string; identityLivemode: boolean | null; identityVerifiedAt: Date | null }) {
  const config = identityConfig();
  return { status: user.identityLivemode === config.live ? user.identityStatus : publicIdentityVerified(user) ? "verified" : "unverified", verifiedAt: user.identityVerifiedAt?.toISOString() ?? null, testMode: user.identityLivemode === false || user.identityLivemode === null && !config.live, enabled: config.enabled };
}
export function identitySessionState(session: Stripe.Identity.VerificationSession, userId: string, sessionId: string, live: boolean) {
  if (session.id !== sessionId || session.livemode !== live) throw identityError("identity_session_mode", "Nieprawidłowa sesja weryfikacji.");
  if (session.redaction?.status) return "redacted";
  if (session.client_reference_id !== userId || session.metadata?.userId !== userId) throw identityError("identity_session_owner", "Nieprawidłowa sesja weryfikacji.");
  // Do not certify weaker sessions created manually or through other flows.
  if (session.type !== "document" || session.options?.document?.require_matching_selfie !== true || session.options?.document?.require_live_capture !== true) throw identityError("identity_session_options", "Nieprawidłowe ustawienia weryfikacji.");
  return session.status;
}
export async function syncIdentity(userId: string) {
  const stripe = identityStripe();
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: identitySelect });
    if (!user.identitySessionId || user.identityLivemode !== identityConfig().live) return identityView(user);
    const session = await stripe.identity.verificationSessions.retrieve(user.identitySessionId);
    const status = identitySessionState(session, user.id, user.identitySessionId, user.identityLivemode);
    const updated = await tx.user.update({ where: { id: user.id }, data: { identityStatus: status, identityVerifiedAt: status === "verified" ? user.identityVerifiedAt ?? new Date() : null }, select: identitySelect });
    return identityView(updated);
  }, { timeout: 20000 });
}
export async function beginIdentity(userId: string) {
  const config = identityConfig();
  if (!config.enabled) throw identityError("identity_disabled", "Weryfikacja tożsamości jest chwilowo niedostępna.");
  const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  let validBase = false;
  try { validBase = !!base && new URL(base).protocol === "https:"; } catch { /* Do not expose the configured URL. */ }
  if (!validBase || !base) throw identityError("identity_return_url", "Weryfikacja tożsamości jest chwilowo niedostępna.");
  const stripe = identityStripe();
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: identitySelect });
    if (publicIdentityVerified(user)) return { ...identityView(user), url: null };
    if (user.identitySessionId && user.identityLivemode === config.live) {
      const existing = await stripe.identity.verificationSessions.retrieve(user.identitySessionId);
      const status = identitySessionState(existing, user.id, user.identitySessionId, config.live);
      if (!["canceled", "redacted"].includes(status)) {
        const updated = await tx.user.update({ where: { id: userId }, data: { identityStatus: status, identityVerifiedAt: status === "verified" ? user.identityVerifiedAt ?? new Date() : null }, select: identitySelect });
        return { ...identityView(updated), url: status === "requires_input" ? safeIdentityUrl(existing.url) : null };
      }
    }
    if (user.identityStartedAt && Date.now() - user.identityStartedAt.getTime() < 60000) throw identityError("identity_retry_limit", "Poczekaj chwilę przed ponowną próbą.");
    const session = await stripe.identity.verificationSessions.create({ type: "document", client_reference_id: userId, metadata: { userId }, return_url: `${base.replace(/\/$/, "")}/account?identity=return#tozsamosc`, options: { document: { require_matching_selfie: true, require_live_capture: true, allowed_types: ["driving_license", "id_card", "passport"] } } }, { idempotencyKey: `mojaszafa-identity-${config.live ? "live" : "test"}-${userId}-${user.identityAttempt}` });
    const status = identitySessionState(session, userId, session.id, config.live);
    const updated = await tx.user.update({ where: { id: userId }, data: { identitySessionId: session.id, identityStatus: status, identityLivemode: config.live, identityVerifiedAt: null, identityStartedAt: new Date(), identityAttempt: { increment: 1 } }, select: identitySelect });
    return { ...identityView(updated), url: safeIdentityUrl(session.url) };
  }, { timeout: 20000 });
}
export function safeIdentityUrl(value: string | null) {
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { throw identityError("identity_redirect_url", "Nieprawidłowy adres weryfikacji."); }
  if (url.protocol !== "https:" || url.hostname !== "verify.stripe.com") throw identityError("identity_redirect_url", "Nieprawidłowy adres weryfikacji.");
  return value;
}
