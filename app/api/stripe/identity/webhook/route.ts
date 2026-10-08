import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";
import { identityConfig, identityStripe, syncIdentity } from "@/app/lib/identityVerification";
export const runtime = "nodejs";
const events = new Set(["identity.verification_session.verified", "identity.verification_session.requires_input", "identity.verification_session.processing", "identity.verification_session.canceled", "identity.verification_session.redacted"]);
export async function POST(req: Request) {
  const secret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
  if (!secret) return new Response("Usługa niedostępna.", { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Nieprawidłowy podpis.", { status: 400 });
  let event: Stripe.Event;
  try { event = identityStripe().webhooks.constructEvent(await req.text(), signature, secret); }
  catch { return new Response("Nieprawidłowy podpis.", { status: 400 }); }
  if (!events.has(event.type) || event.livemode !== identityConfig().live) return Response.json({ received: true });
  const object = event.data.object as Stripe.Identity.VerificationSession;
  try {
    // Bind by the session recorded by our server, never by untrusted metadata alone.
    const user = await prisma.user.findUnique({ where: { identitySessionId: object.id }, select: { id: true } });
    if (user) await syncIdentity(user.id); // Fetch current state to tolerate reordered/repeated events.
    return Response.json({ received: true });
  } catch { return new Response("Nie udało się zapisać wyniku.", { status: 500 }); }
}
