// app/api/stripe/create-intents/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const runtime = "nodejs";

type Body = {
  bookingId: string;
};

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return new NextResponse("Missing STRIPE_SECRET_KEY", { status: 500 });

  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  const bookingId = body.bookingId?.trim();
  if (!bookingId) return new NextResponse("Missing bookingId", { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: { include: { user: true } },
    },
  });

  if (!booking) return new NextResponse("Booking not found", { status: 404 });
  if (booking.renterId !== userId) return new NextResponse("Forbidden", { status: 403 });

  // Solo permitimos crear intents cuando el dueño ya aprobó
  const now = new Date();

if (
  booking.status !== "AWAITING_PAYMENT" ||
  booking.paymentStatus !== "PENDING"
) {
  return new NextResponse(
    "Booking must be awaiting payment with pending payment status",
    { status: 400 }
  );
}

if (booking.paymentDueAt && booking.paymentDueAt < now) {
  return new NextResponse("Booking payment window has expired", { status: 400 });
}

  // Importes (en céntimos)
  const rentAmount = booking.amountCents ?? 0;
  const depositAmount = booking.depositCents ?? 0;
  const totalAmount = rentAmount + depositAmount;

  const currency = "pln";

  if (rentAmount <= 0) return new NextResponse("Invalid amountCents for rent", { status: 400 });
  if (depositAmount < 0) return new NextResponse("Invalid depositCents for deposit", { status: 400 });
  if (totalAmount <= 0) return new NextResponse("Invalid total amount", { status: 400 });

  const stripe = new Stripe(secretKey, {
    apiVersion: "2025-09-30.clover",
  });

  // ==========================================================
  // IDEMPOTENCIA: si ya existe PaymentIntent reutilizable
  // ==========================================================
  if (booking.paymentRef) {
    try {
      const existingPI = await stripe.paymentIntents.retrieve(booking.paymentRef);

      if (
        existingPI.client_secret &&
        existingPI.status !== "succeeded" &&
        existingPI.status !== "canceled"
      ) {
        return NextResponse.json({
          clientSecret: existingPI.client_secret,
          paymentIntentId: existingPI.id,

          currency,
          rentAmountCents: rentAmount,
          depositAmountCents: depositAmount,
          totalAmountCents: totalAmount,
        });
      }
    } catch (err) {
      console.error("Failed retrieving existing PI", err);
    }

    // si el PI viejo ya no sirve -> limpiamos
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentRef: null,
        depositPaymentIntentId: null,
      },
    });
  }

  // ==========================================================
  // PAYMENT INTENT ÚNICO (rent + deposit)
  // ==========================================================
  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalAmount,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: {
      bookingId: booking.id,
      kind: "booking_payment",
      listingId: booking.listingId,
      renterId: booking.renterId,
      rentAmountCents: String(rentAmount),
      depositAmountCents: String(depositAmount),
    },
  });

  // Guardamos ID
  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      paymentRef: paymentIntent.id,
      depositPaymentIntentId: null,
    },
  });

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,

    currency,
    rentAmountCents: rentAmount,
    depositAmountCents: depositAmount,
    totalAmountCents: totalAmount,
  });
}