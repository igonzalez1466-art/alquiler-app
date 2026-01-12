import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing stripe-signature", { status: 400 });

  const rawBody = await req.text();

  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.bookingId;
      const paymentIntentId = session.payment_intent as string | undefined;

      if (bookingId) {
        // Marca como pagado y guarda referencia/importe
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: "PAID",               // si prefieres mantener tu flujo: "CONFIRMED"
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
  } catch (err: any) {
    console.error("❌ Webhook error:", err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }
}

export const config = {
  api: {
    bodyParser: false, // Next 13/14 (por compatibilidad); en app router usamos req.text()
  },
};
