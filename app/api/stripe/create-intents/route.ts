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
  if (booking.status !== "CONFIRMED") {
    return new NextResponse("Booking must be CONFIRMED before payment", { status: 400 });
  }

  // Importes (en céntimos)
  const rentAmount = booking.amountCents ?? 0;
  const depositAmount = booking.depositCents ?? 0;
  const currency = "pln"; // si algún día lo guardas en BD, cámbialo a booking/listing

  if (rentAmount <= 0) return new NextResponse("Invalid amountCents for rent", { status: 400 });
  if (depositAmount <= 0) return new NextResponse("Invalid depositCents for deposit", { status: 400 });

  const stripe = new Stripe(secretKey, {
    // Si te funciona tal cual, OK. Si Stripe te diera problemas, elimina apiVersion
    apiVersion: "2025-09-30.clover",
  });

  // Idempotencia: si ya existen IDs, devolvemos client_secret (ideal para refresh)
  // Nota: paymentRef lo usamos como rentPaymentIntentId
  if (booking.paymentRef && booking.depositPaymentIntentId) {
    const [rentPI, depositPI] = await Promise.all([
      stripe.paymentIntents.retrieve(booking.paymentRef),
      stripe.paymentIntents.retrieve(booking.depositPaymentIntentId),
    ]);

    return NextResponse.json({
      rentClientSecret: rentPI.client_secret,
      depositClientSecret: depositPI.client_secret,
      rentPaymentIntentId: rentPI.id,
      depositPaymentIntentId: depositPI.id,

      // ✅ NUEVO: para mostrar importes en la UI
      currency,
      rentAmountCents: rentAmount,
      depositAmountCents: depositAmount,
    });
  }

  const transferGroup = `BOOKING_${booking.id}`;

  // 1) RENT: cobro normal
  const rentPI = await stripe.paymentIntents.create({
    amount: rentAmount,
    currency,
    automatic_payment_methods: { enabled: true },
    transfer_group: transferGroup,
    metadata: {
      bookingId: booking.id,
      kind: "rent",
      listingId: booking.listingId,
      renterId: booking.renterId,
    },
  });

  // 2) DEPOSIT: HOLD (manual capture)
  const depositPI = await stripe.paymentIntents.create({
    amount: depositAmount,
    currency,
    capture_method: "manual", // <- HOLD real
    automatic_payment_methods: { enabled: true },
    metadata: {
      bookingId: booking.id,
      kind: "deposit",
      listingId: booking.listingId,
      renterId: booking.renterId,
    },
  });

  // Guardamos IDs en Booking
  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      paymentRef: rentPI.id, // ✅ rent PI
      depositPaymentIntentId: depositPI.id, // ✅ deposit PI
    },
  });

  return NextResponse.json({
    rentClientSecret: rentPI.client_secret,
    depositClientSecret: depositPI.client_secret,
    rentPaymentIntentId: rentPI.id,
    depositPaymentIntentId: depositPI.id,

    // ✅ NUEVO: para mostrar importes en la UI
    currency,
    rentAmountCents: rentAmount,
    depositAmountCents: depositAmount,
  });
}