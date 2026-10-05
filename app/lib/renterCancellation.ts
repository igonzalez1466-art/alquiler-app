import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { settlementOperation } from "@/app/lib/settlement";
import { sendMail } from "@/app/lib/mailer";
import { canRenterCancelBooking, readRenterCancellation, type RenterCancellation } from "./renterCancellationPolicy";

const json = (value: RenterCancellation) => value as unknown as Prisma.InputJsonValue;
const stripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Konfiguracja płatności niedostępna.");
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-09-30.clover", timeout: 10000, maxNetworkRetries: 0 });
};
const transactionOptions = { timeout: 45000, maxWait: 5000 };

export async function cancelBookingByRenter(bookingId: string, userId: string) {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
    const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (b.renterId !== userId) throw new Error("Tylko najemca może anulować tę rezerwację.");
    const previous = readRenterCancellation(b.renterCancellation);
    if (previous) return;
    if (!canRenterCancelBooking(b, userId)) throw new Error("Rezerwację można anulować najpóźniej 7 dni przed rozpoczęciem, przed potwierdzeniem odbioru i rozliczeniem najmu.");
    if (b.settlementLegacyReview || b.depositClaim || await tx.settlementOperation.findFirst({ where: { bookingId } })) throw new Error("Płatność wymaga weryfikacji przed anulowaniem.");
    let amountCents = 0;
    if (b.paymentRef) {
      const stripe = stripeClient();
      const pi = await stripe.paymentIntents.retrieve(b.paymentRef, { expand: ["latest_charge"] });
      const expected = b.rentAmountCents ?? b.amountCents ?? 0;
      if (pi.metadata.bookingId !== bookingId || pi.currency !== "pln" || pi.amount !== expected) throw new Error("Nie można potwierdzić płatności tej rezerwacji.");
      if (pi.status === "succeeded") {
        const charge = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
        if (!charge || charge.disputed || charge.amount_refunded > 0 || pi.amount_received !== expected) throw new Error("Płatność wymaga weryfikacji przed zwrotem.");
        amountCents = pi.amount_received;
      } else if (b.paymentStatus === "PAID") throw new Error("Nie można potwierdzić opłaconej rezerwacji.");
      else if (pi.status !== "canceled") {
        // Stripe rejects this if the payment completes concurrently; no booking is cancelled in that case.
        const cancelled = await stripe.paymentIntents.cancel(pi.id);
        if (cancelled.status !== "canceled") throw new Error("Płatność jest w toku. Spróbuj ponownie za chwilę.");
      }
    } else if (b.paymentStatus === "PAID" || b.paidAt) throw new Error("Brak danych płatności do zwrotu.");
    const now = new Date();
    const saved: RenterCancellation = { requestedAt: now.toISOString(), requestedById: userId, amountCents,
      paymentIntent: amountCents > 0 ? b.paymentRef : null, status: amountCents > 0 ? "PENDING" : "NONE", refundId: null, lastError: null,
      notifications: { owner: { sentAt: null, leaseUntil: null }, renter: { sentAt: null, leaseUntil: null } } };
    await tx.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED", cancelledAt: now,
      paymentStatus: amountCents > 0 ? "PAID" : "CANCELLED", ...(amountCents > 0 && !b.paidAt ? { paidAt: now } : {}),
      renterCancellation: json(saved), ...(amountCents === 0 ? { settlementCompletedAt: now } : {}) } });
    await tx.incident.updateMany({ where: { bookingId, status: { not: "RESOLVED" } }, data: { status: "RESOLVED", resolvedAt: now, resolution: "Rezerwacja anulowana przez najemcę zgodnie z zasadą 7 dni. Pełny zwrot płatności." } });
  }, transactionOptions);
  return processRenterCancellation(bookingId);
}

export async function processRenterCancellation(bookingId: string) {
  try {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
      const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      const saved = readRenterCancellation(b.renterCancellation);
      if (!saved || ["NONE", "SUCCEEDED", "FAILED"].includes(saved.status)) return;
      if (b.status !== "CANCELLED" || !saved.paymentIntent || b.ownerTransferId) throw new Error("Anulowanie wymaga weryfikacji.");
      const stripe = stripeClient();
      const operation = await settlementOperation(stripe, bookingId, "refund", { payment_intent: saved.paymentIntent,
        amount: saved.amountCents, reason: "requested_by_customer", metadata: { bookingId, type: "renter_cancellation" } });
      const refund = await stripe.refunds.retrieve(operation.id);
      const paymentIntent = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
      if (refund.amount !== saved.amountCents || refund.currency !== "pln" || paymentIntent !== saved.paymentIntent) throw new Error("Nieprawidłowe dane zwrotu.");
      saved.refundId = refund.id;
      saved.status = refund.status === "succeeded" ? "SUCCEEDED" : ["failed", "canceled"].includes(refund.status ?? "") ? "FAILED" : "PENDING";
      saved.lastError = saved.status === "FAILED" ? "Zwrot wymaga pomocy obsługi serwisu." : null;
      await tx.booking.update({ where: { id: bookingId }, data: { renterCancellation: json(saved),
        ...(saved.status === "SUCCEEDED" ? { paymentStatus: "REFUNDED", rentRefundedCents: saved.amountCents, refundedAt: new Date(), settlementCompletedAt: new Date() } : {}) } });
    }, transactionOptions);
  } catch (error) {
    console.error("[RENTER CANCELLATION] Refund requires retry", bookingId, error);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
      const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      const saved = readRenterCancellation(b.renterCancellation);
      if (saved && saved.status === "PENDING") await tx.booking.update({ where: { id: bookingId }, data: { renterCancellation: json({ ...saved, lastError: "Zwrot oczekuje na ponowienie. Rezerwacja pozostaje anulowana." }) } });
    });
  }
  await notifyRenterCancellation(bookingId);
  const latest = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, select: { renterCancellation: true } });
  return readRenterCancellation(latest.renterCancellation)?.status ?? null;
}

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
async function notifyRenterCancellation(bookingId: string) {
  for (const role of ["owner", "renter"] as const) {
    const notification = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
      const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { owner: true, renter: true, listing: true } });
      const saved = readRenterCancellation(b.renterCancellation);
      if (!saved || saved.notifications[role].sentAt || (saved.notifications[role].leaseUntil && new Date(saved.notifications[role].leaseUntil!) > new Date())) return null;
      saved.notifications[role].leaseUntil = new Date(Date.now() + 5 * 60000).toISOString();
      await tx.booking.update({ where: { id: bookingId }, data: { renterCancellation: json(saved) } });
      return { b, saved, to: b[role].email };
    });
    if (!notification) continue;
    let sent = false;
    try {
      if (!notification.to) throw new Error("Brak adresu email.");
      const { b, saved } = notification;
      const amount = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(saved.amountCents / 100);
      const dates = `${b.startDate.toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })} — ${b.endDate.toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}`;
      const refundInfo = saved.amountCents === 0 ? "Rezerwacja nie została opłacona. Nie ma środków do zwrotu."
        : saved.status === "SUCCEEDED" ? `Pełny zwrot (100%): ${amount}. Stripe potwierdził zwrot na pierwotną metodę płatności. Termin zaksięgowania zależy od banku.`
        : saved.status === "FAILED" ? `Najemcy przysługuje pełny zwrot (100%): ${amount}. Zwrot wymaga pomocy obsługi serwisu; sprawdź stan w rezerwacji.` : `Najemcy przysługuje pełny zwrot (100%): ${amount} na pierwotną metodę płatności. Zwrot jest w toku; jego stan można sprawdzić w rezerwacji.`;
      const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || process.env.AUTH_URL;
      const url = baseUrl ? `${baseUrl.replace(/\/$/, "")}/bookings/${encodeURIComponent(bookingId)}` : null;
      const title = `Rezerwacja #${b.bookingNumber ?? b.id} została anulowana przez najemcę`;
      await sendMail({ to: notification.to, subject: title, text: `${title}\n${b.listing.title}\n${dates}\n${refundInfo}\n${url ?? ""}`,
        html: `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(b.listing.title)}</p><p>${escapeHtml(dates)}</p><p>${escapeHtml(refundInfo)}</p>${url ? `<p><a href="${escapeHtml(url)}">Otwórz rezerwację</a></p>` : ""}<p>Zespół MojaSzafa</p>` });
      sent = true;
    } catch (error) { console.error("[RENTER CANCELLATION] Email requires retry", bookingId, role, error); }
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
      const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      const saved = readRenterCancellation(b.renterCancellation);
      if (!saved) return;
      saved.notifications[role] = { sentAt: sent ? new Date().toISOString() : null, leaseUntil: null };
      await tx.booking.update({ where: { id: bookingId }, data: { renterCancellation: json(saved) } });
    });
  }
}
