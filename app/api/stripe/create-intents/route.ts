import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authConfig);

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json().catch(() => null);

  const id =
    typeof body?.bookingId === "string"
      ? body.bookingId.trim()
      : "";

  if (!id) {
    return new NextResponse("Missing bookingId", { status: 400 });
  }

  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    return new NextResponse("Payment configuration unavailable", {
      status: 503,
    });
  }

  const stripe = new Stripe(key, {
    apiVersion: "2025-09-30.clover",
    timeout: 8000,
    maxNetworkRetries: 0,
  });

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Usa el mismo bloqueo que la cancelación por vencimiento.
        await tx.$queryRaw`
          SELECT id
          FROM "Booking"
          WHERE id = ${id}
          FOR UPDATE
        `;

        const booking = await tx.booking.findUnique({
          where: { id },
        });

        if (!booking || booking.renterId !== userId) {
          return {
            error: "Booking not found",
            status: 404,
          };
        }

        if (
          booking.status !== "AWAITING_PAYMENT" ||
          booking.paymentStatus !== "PENDING" ||
          booking.paidAt
        ) {
          return {
            error: "Ta rezerwacja nie oczekuje na płatność.",
            status: 409,
          };
        }

        if (
          !booking.paymentDueAt ||
          booking.paymentDueAt <= new Date()
        ) {
          return {
            error:
              "Termin płatności upłynął. Nie można rozpocząć płatności.",
            status: 410,
          };
        }

        const rent =
          booking.rentAmountCents ?? booking.amountCents ?? 0;

        const deposit = booking.depositCents ?? 0;

        if (rent <= 0 || deposit < 0) {
          return {
            error: "Invalid amounts",
            status: 400,
          };
        }

        // Reutiliza el intento existente. La clave de idempotencia
        // evita crear otro si hay que repetir la misma petición.
        const paymentIntent = booking.paymentRef
          ? await stripe.paymentIntents.retrieve(booking.paymentRef)
          : await stripe.paymentIntents.create(
              {
                amount: rent + deposit,
                currency: "pln",
                automatic_payment_methods: {
                  enabled: true,
                },
                metadata: {
                  bookingId: booking.id,
                  kind: "booking_payment",
                  listingId: booking.listingId,
                  renterId: booking.renterId,
                  rentAmountCents: String(rent),
                  depositAmountCents: String(deposit),
                },
              },
              {
                idempotencyKey: `booking-payment-${booking.id}`,
              }
            );

        if (!booking.paymentRef) {
          await tx.booking.update({
            where: { id },
            data: {
              paymentRef: paymentIntent.id,
              depositPaymentIntentId: null,
            },
          });
        }

        if (
          paymentIntent.amount !== rent + deposit ||
          paymentIntent.currency !== "pln" ||
          paymentIntent.metadata.bookingId !== id
        ) {
          return {
            error: "Payment does not match booking",
            status: 409,
          };
        }

        if (
          [
            "succeeded",
            "canceled",
            "processing",
            "requires_capture",
          ].includes(paymentIntent.status)
        ) {
          return {
            error:
              "Płatność jest zakończona, anulowana lub w trakcie przetwarzania. Odśwież rezerwację.",
            status: 409,
          };
        }

        // Comprueba nuevamente el plazo después de consultar Stripe.
        if (booking.paymentDueAt <= new Date()) {
          return {
            error: "Termin płatności upłynął.",
            status: 410,
          };
        }

        return {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          currency: "pln",
          rentAmountCents: rent,
          depositAmountCents: deposit,
          totalAmountCents: rent + deposit,
        };
      },
      {
        timeout: 25000,
        maxWait: 5000,
      }
    );

    if ("error" in result) {
      return new NextResponse(result.error, {
        status: result.status,
      });
    }

    return NextResponse.json(result);
  } catch {
    return new NextResponse(
      "Nie można teraz przygotować płatności. Spróbuj ponownie.",
      { status: 503 }
    );
  }
}