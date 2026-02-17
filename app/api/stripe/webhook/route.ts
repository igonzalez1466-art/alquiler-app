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
    apiVersion: "2025-09-30.clover",
  });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing stripe-signature", { status: 400 });

  const rawBody = await req.text();

  // 1) Verificar firma y construir evento
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ Webhook signature verification failed:", message);
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  // 2) Procesar evento (ruteamos por string, sin pelear con unions TS)
  try {
    const type = String(event.type);

    switch (type) {
      // ==========================================================
      // LEGACY: Checkout (si aún lo usas en alguna parte)
      // ==========================================================
      case "checkout.session.completed": {
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
          console.log("✅ Booking pagada (Checkout):", bookingId);
        }
        break;
      }

      // ==========================================================
      // NUEVO: PaymentIntent succeeded => ALQUILER cobrado
      // Requiere metadata: { bookingId, kind: "rent" }
      // ==========================================================
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.bookingId;
        const kind = pi.metadata?.kind;

        if (bookingId && kind === "rent") {
          await prisma.booking.update({
            where: { id: bookingId },
            data: {
              status: "PAID",
              paymentStatus: "PAID",
              paymentMethod: "CARD",
              paymentRef: pi.id, // PI del alquiler
              paidAt: new Date(),
              amountCents: pi.amount,
            },
          });
          console.log("✅ Booking pagada (Rent PI):", bookingId, pi.id);
        }
        break;
      }

      // ==========================================================
      // NUEVO: amount_capturable_updated => Fianza en HOLD (autorizada)
      // Requiere metadata: { bookingId, kind: "deposit" }
      // ==========================================================
      case "payment_intent.amount_capturable_updated": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.bookingId;
        const kind = pi.metadata?.kind;

        if (bookingId && kind === "deposit") {
          await prisma.booking.update({
            where: { id: bookingId },
            data: {
              depositStatus: "HELD",
              depositPaymentIntentId: pi.id,
              depositCents: pi.amount,
            },
          });
          console.log("🧊 Fianza en hold (Deposit PI):", bookingId, pi.id);
        }
        break;
      }

      // ==========================================================
      // (Opcional) captured => Fianza CAPTURADA
      // ==========================================================
      case "payment_intent.captured": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.bookingId;
        const kind = pi.metadata?.kind;

        if (bookingId && kind === "deposit") {
          await prisma.booking.update({
            where: { id: bookingId },
            data: { depositStatus: "CAPTURED" },
          });
          console.log("💥 Fianza capturada (Deposit PI):", bookingId, pi.id);
        }
        break;
      }

      // ==========================================================
      // (Opcional) canceled => Fianza LIBERADA (hold cancelado)
      // ==========================================================
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.bookingId;
        const kind = pi.metadata?.kind;

        if (bookingId && kind === "deposit") {
          await prisma.booking.update({
            where: { id: bookingId },
            data: { depositStatus: "RELEASED" },
          });
          console.log("✅ Fianza liberada (Deposit PI):", bookingId, pi.id);
        }
        break;
      }

      default: {
        // console.log("Unhandled event:", type);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ Webhook processing error:", message);
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }
}

// Nota: en App Router este config no se usa; puedes borrarlo si quieres.
export const config = {
  api: { bodyParser: false },
};
