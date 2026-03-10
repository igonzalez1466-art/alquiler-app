// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-09-30.clover",
  });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing stripe-signature", { status: 400 });

  const rawBody = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature failed", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {

      // =====================================================
      // ALQUILER PAGADO
      // =====================================================
      case "payment_intent.succeeded": {

        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.bookingId;
        const kind = pi.metadata?.kind;

        if (!bookingId) break;

        // -----------------------------
        // Pago del alquiler
        // -----------------------------
        if (kind === "rent") {

          await prisma.booking.update({
            where: { id: bookingId },
            data: {
              status: "PAID",
              paymentStatus: "PAID",
              paymentMethod: "CARD",
              paymentRef: pi.id,
              paidAt: new Date(),
              amountCents: pi.amount,
            },
          });

          console.log("✅ Rent paid:", bookingId);
        }

        // -----------------------------
        // Pago de la fianza
        // -----------------------------
        if (kind === "deposit") {

          await prisma.booking.update({
            where: { id: bookingId },
            data: {
              depositStatus: "PAID",
              depositPaymentIntentId: pi.id,
              depositCents: pi.amount,
              depositPaidAt: new Date(),
            },
          });

          console.log("💰 Deposit paid:", bookingId);
        }

        break;
      }

      // =====================================================
      // REFUND DE FIANZA
      // =====================================================
      case "charge.refunded": {

        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        const booking = await prisma.booking.findFirst({
          where: { depositPaymentIntentId: paymentIntentId },
        });

        if (!booking) break;

        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            depositStatus: "REFUNDED",
            depositRefundedAt: new Date(),
            depositRefundedCents: charge.amount_refunded,
          },
        });

        console.log("↩️ Deposit refunded:", booking.id);

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    console.error("Webhook error:", err);
    return new NextResponse("Webhook handler failed", { status: 500 });
  }
}