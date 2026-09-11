import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";

export const PAYMENT_WINDOW_MS = 2 * 60 * 60 * 1000;

export async function expireUnpaidBooking(id: string) {
  return prisma.$transaction(
    async (tx) => {
      // Evita que la creación del pago y la cancelación
      // modifiquen simultáneamente la misma reserva.
      await tx.$queryRaw`
        SELECT id
        FROM "Booking"
        WHERE id = ${id}
        FOR UPDATE
      `;

      const booking = await tx.booking.findUnique({
        where: { id },
      });

      if (
        !booking ||
        booking.status !== "AWAITING_PAYMENT" ||
        booking.paymentStatus !== "PENDING" ||
        booking.paidAt ||
        !booking.paymentDueAt ||
        booking.paymentDueAt > new Date()
      ) {
        return false;
      }

      if (booking.paymentRef) {
        const key = process.env.STRIPE_SECRET_KEY;

        if (!key) {
          throw new Error("Missing STRIPE_SECRET_KEY");
        }

        const stripe = new Stripe(key, {
          apiVersion: "2025-09-30.clover",
          timeout: 8000,
          maxNetworkRetries: 0,
        });

        const paymentIntent =
          await stripe.paymentIntents.retrieve(booking.paymentRef);

        // Conserva la reserva si el pago está completado,
        // en proceso o autorizado.
        if (
          ["succeeded", "processing", "requires_capture"].includes(
            paymentIntent.status
          )
        ) {
          return false;
        }

        if (paymentIntent.status !== "canceled") {
          // Si el pago se completa antes de esta cancelación,
          // Stripe rechaza la operación y no se cancela la reserva.
          const cancelledIntent =
            await stripe.paymentIntents.cancel(paymentIntent.id);

          if (cancelledIntent.status !== "canceled") {
            return false;
          }
        }
      }

      const result = await tx.booking.updateMany({
        where: {
          id,
          status: "AWAITING_PAYMENT",
          paymentStatus: "PENDING",
          paidAt: null,
          paymentDueAt: {
            lte: new Date(),
          },
        },
        data: {
          status: "CANCELLED",
          paymentStatus: "CANCELLED",
          cancelledAt: new Date(),
        },
      });

      return result.count === 1;
    },
    {
      timeout: 25000,
      maxWait: 5000,
    }
  );
}