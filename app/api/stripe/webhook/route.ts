// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

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
  if (!sig) {
    return new NextResponse("Missing stripe-signature", { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature failed", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.bookingId;
        const kind = pi.metadata?.kind;

        if (!bookingId || kind !== "booking_payment") {
          break;
        }

        const rentAmountCents = Number(pi.metadata?.rentAmountCents ?? "0");
        const depositAmountCents = Number(pi.metadata?.depositAmountCents ?? "0");

        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: "PAID",
            paymentStatus: "PAID",
            paymentMethod: "CARD",
            paymentRef: pi.id,
            paidAt: new Date(),

            // parte del alquiler
            amountCents: rentAmountCents,

            // parte de la fianza
            depositCents: depositAmountCents,
            depositStatus: depositAmountCents > 0 ? "PAID" : "NONE",
            depositPaidAt: depositAmountCents > 0 ? new Date() : null,

            // opcional: reutilizamos este campo para localizar luego refunds
            depositPaymentIntentId: depositAmountCents > 0 ? pi.id : null,
          },
        });

        console.log("✅ Booking paid:", bookingId, pi.id);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;

        if (!paymentIntentId) {
          break;
        }

        const booking = await prisma.booking.findFirst({
          where: { depositPaymentIntentId: paymentIntentId },
        });

        if (!booking || !booking.depositCents) {
          break;
        }

        const refundedCents = charge.amount_refunded;
        const retainedCents = Math.max(booking.depositCents - refundedCents, 0);

        let depositStatus:
          | "REFUNDED"
          | "PARTIALLY_REFUNDED"
          | "RETAINED"
          | "PAID" = "PAID";

        if (refundedCents === 0) {
          depositStatus = "RETAINED";
        } else if (refundedCents >= booking.depositCents) {
          depositStatus = "REFUNDED";
        } else {
          depositStatus = "PARTIALLY_REFUNDED";
        }

        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            depositStatus,
            depositRefundedAt: refundedCents > 0 ? new Date() : booking.depositRefundedAt,
            depositRefundedCents: refundedCents,
            depositRetainedCents: retainedCents,
          },
        });

        console.log("↩️ Deposit refund updated:", booking.id, {
          refundedCents,
          retainedCents,
          depositStatus,
        });

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