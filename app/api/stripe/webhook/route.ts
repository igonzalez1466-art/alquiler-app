// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs"; // Stripe + raw body

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error("Missing Stripe env vars", {
      hasSecretKey: !!secretKey,
      hasWebhookSecret: !!webhookSecret,
    });
    return new NextResponse("Missing Stripe env vars", { status: 500 });
  }

  const stripe = new Stripe(secretKey, {
    // deja tu apiVersion si estás usando esa concretamente
    apiVersion: "2025-09-30.clover",
  });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing stripe-signature", { status: 400 });

  const rawBody = await req.text();

  try {
    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.bookingId;
      const paymentIntentId = session.payment_intent as string | undefined;

      if (bookingId) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: "PAID",
            paymentStatus: "PAID",
            paymentMethod: "CARD",
            paymentRef: paymentIntentId ?? session.id,
            paidAt: new Date(),
            amountCents: session.amount_total ?? undefined,
          },
        });
        console.log("✅ Booking pagada:", bookingId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ Webhook error:", message);
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }
}

// Nota: en App Router este config no se usa; puedes borrarlo si quieres.
export const config = {
  api: { bodyParser: false },
};
