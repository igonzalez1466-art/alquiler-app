import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";
import { readIssue } from "@/app/lib/logisticsIssue";
import { finishSettlement, settlementOperation } from "@/app/lib/settlement";

/** Pays the owner after a rent-only reservation has been returned and accepted. */
export async function settleRentOnlyBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { owner: { select: { stripeAccountId: true } } },
  });
  if (!booking) throw new Error("Rezerwacja nie istnieje.");
  if (booking.settlementCompletedAt) return false;
  if (booking.cancelledAt || booking.status === "CANCELLED" || booking.paymentStatus !== "PAID") {
    throw new Error("Rezerwacja nie jest gotowa do rozliczenia.");
  }
  if ((booking.depositCents ?? 0) !== 0 || booking.depositStatus !== "NONE" || booking.depositClaim !== null) {
    throw new Error("Ta rezerwacja wymaga wcześniejszego rozliczenia kaucji.");
  }
  if (booking.settlementLegacyReview || booking.settlementDecision) {
    throw new Error("Wymagana weryfikacja wcześniejszego rozliczenia.");
  }
  if (!["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.deliveryConfirmationStatus) ||
      !["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.returnConfirmationStatus)) {
    throw new Error("Najpierw potwierdź odbiór i zwrot przedmiotu.");
  }
  for (const stored of [booking.deliveryIssue, booking.returnIssue]) {
    if (stored !== null && !readIssue(stored)?.resolvedAt) {
      throw new Error("Najpierw rozwiąż zgłoszony problem.");
    }
  }
  const rent = booking.rentAmountCents;
  const fee = booking.platformFeeCents;
  const payout = booking.ownerPayoutCents;
  if (!Number.isSafeInteger(rent) || !Number.isSafeInteger(fee) || !Number.isSafeInteger(payout) ||
      !rent || fee == null || fee < 0 || !payout || payout <= 0 || rent !== fee + payout) {
    throw new Error("Brak poprawnych kwot rozliczenia rezerwacji.");
  }
  const destination = booking.owner.stripeAccountId;
  let transfer: { id: string; amount: number | null };
  if (booking.ownerTransferId) {
    transfer = { id: booking.ownerTransferId, amount: booking.ownerTransferCents };
  } else {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!destination || !secret) throw new Error("Właściciel musi skonfigurować konto wypłat.");
    const previous = await prisma.settlementOperation.findUnique({
      where: { bookingId_kind: { bookingId, kind: "rent" } },
    });
    if (previous) {
      const params = previous.params;
      if (!params || typeof params !== "object" || Array.isArray(params) ||
          params.amount !== payout || params.destination !== destination) {
        throw new Error("Dane wcześniejszego transferu wymagają weryfikacji przez obsługę.");
      }
    }
    if (previous?.stripeId) {
      transfer = { id: previous.stripeId, amount: previous.amount };
    } else {
      const stripe = new Stripe(secret, {
        apiVersion: "2025-09-30.clover",
        timeout: 10000,
        maxNetworkRetries: 0,
      });
      const account = await stripe.accounts.retrieve(destination);
      if (account.details_submitted !== true || account.payouts_enabled !== true ||
          account.capabilities?.transfers !== "active") {
        throw new Error("Konto wypłat właściciela nie jest jeszcze aktywne.");
      }
      transfer = await settlementOperation(stripe, booking.id, "rent", {
        amount: payout,
        currency: "pln",
        destination,
        metadata: {
          bookingId: booking.id,
          bookingNumber: String(booking.bookingNumber),
          type: "rental_owner_payout",
        },
      });
    }
  }
  if (transfer.amount !== payout) throw new Error("Kwota transferu nie zgadza się z rezerwacją.");
  return finishSettlement(booking.id, {
    ownerTransferId: transfer.id,
    ownerTransferCents: payout,
    ownerTransferredAt: new Date(),
  });
}

export async function trySettleRentOnlyBooking(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        depositCents: true,
        depositStatus: true,
        deliveryConfirmationStatus: true,
        returnConfirmationStatus: true,
      },
    });
    if (!booking || (booking.depositCents ?? 0) !== 0 || booking.depositStatus !== "NONE" ||
        !["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.deliveryConfirmationStatus) ||
        !["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.returnConfirmationStatus)) return;
    await settleRentOnlyBooking(bookingId);
  } catch (error) {
    console.error("[RENT PAYOUT] Reservation requires retry", bookingId, error);
  }
}
