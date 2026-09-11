import { prisma } from "@/app/lib/prisma";
import { sendMail } from "@/app/lib/mailer";

type Eligibility = {
  status: string; paymentStatus: string; paidAt: Date | null; endDate: Date;
  returnConfirmationStatus: string; depositCents: number | null;
  depositStatus: string; settlementCompletedAt: Date | null;
};

export function canInviteToReview(b: Eligibility, now = new Date()) {
  return b.status === "CONFIRMED" && b.paymentStatus === "PAID" && !!b.paidAt &&
    b.endDate < now && ["CONFIRMED", "AUTO_CONFIRMED"].includes(b.returnConfirmationStatus) &&
    ((b.depositCents === 0 && b.depositStatus === "NONE") ||
      (!!b.settlementCompletedAt && ["REFUNDED", "PARTIALLY_REFUNDED", "RETAINED"].includes(b.depositStatus)));
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

// Exactly one row per participant and booking. SENDING is never automatically
// retried: SMTP may have accepted the email before the connection was lost.
export async function inviteBookingReview(bookingId: string) {
  const enabled = await prisma.$queryRaw<{ enabled: boolean }[]>`
    SELECT "reviewInvitationsEnabled" AS enabled FROM "Booking" WHERE id = ${bookingId}`;
  if (!enabled[0]?.enabled) return;
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: {
    owner: { select: { id: true, email: true, name: true } },
    renter: { select: { id: true, email: true, name: true } },
    listing: { select: { title: true } },
  } });
  if (!booking || !canInviteToReview(booking)) return;
  const base = process.env.APP_URL;
  if (!base) throw new Error("APP_URL is required for review invitations");
  const url = new URL(`/bookings?review=${encodeURIComponent(bookingId)}#review-${encodeURIComponent(bookingId)}`, base).toString();

  for (const recipient of [booking.owner, booking.renter]) {
    await prisma.$executeRaw`
      INSERT INTO "ReviewInvitation" ("bookingId", "recipientId") VALUES (${bookingId}, ${recipient.id})
      ON CONFLICT ("bookingId", "recipientId") DO NOTHING`;
    const reviewed = await prisma.review.findFirst({ where: { bookingId, reviewerId: recipient.id }, select: { id: true } });
    if (reviewed || !recipient.email) {
      await prisma.$executeRaw`UPDATE "ReviewInvitation" SET status = 'SKIPPED'
        WHERE "bookingId" = ${bookingId} AND "recipientId" = ${recipient.id} AND status = 'PENDING'`;
      continue;
    }
    // Validate configuration BEFORE claiming: a missing setting is safe to retry.
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error("SMTP configuration is incomplete");
    }
    const claimed = await prisma.$queryRaw<{ recipientId: string }[]>`
      UPDATE "ReviewInvitation" SET status = 'SENDING', "attemptedAt" = NOW(), attempts = attempts + 1
      WHERE "bookingId" = ${bookingId} AND "recipientId" = ${recipient.id}
      AND status = 'PENDING' AND "nextAttemptAt" <= NOW()
      RETURNING "recipientId"`;
    if (!claimed.length) continue;
    const other = recipient.id === booking.ownerId ? booking.renter : booking.owner;
    const role = recipient.id === booking.ownerId ? "najemcą" : "właścicielem";
    try {
      await sendMail({
        to: recipient.email,
        subject: `Oceń wynajem #${booking.bookingNumber}: ${booking.listing.title}`,
        text: `Cześć ${recipient.name || ""}! Wynajem ${booking.listing.title} (#${booking.bookingNumber}) został zakończony. Jak oceniasz doświadczenie z ${role} ${other.name || ""}? Twoja szczera opinia pomoże innym użytkownikom. Oceń doświadczenie: ${url}`,
        html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111">
          <p>Cześć ${escapeHtml(recipient.name || "")}!</p>
          <p>Wynajem został zakończony. Podziel się swoją opinią o doświadczeniu z ${role}.</p>
          <div style="padding:16px;margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa">
            <strong>${escapeHtml(booking.listing.title)}</strong><br>
            Numer rezerwacji: #${booking.bookingNumber}<br>
            ${recipient.id === booking.ownerId ? "Najemca" : "Właściciel"}: ${escapeHtml(other.name || "Użytkownik")}
          </div>
          <p>Twoja szczera opinia pomoże innym użytkownikom podejmować decyzje.</p>
          <p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;background:#111827;color:#fff;border-radius:6px;text-decoration:none">Oceń doświadczenie</a></p>
          <p style="font-size:12px;color:#6b7280">Aby dodać opinię, zaloguj się na konto użyte przy rezerwacji.</p>
          <hr style="border:0;border-top:1px solid #eee;margin:18px 0">
          <p>Pozdrawiamy,<br><strong>Zespół MojaSzafa</strong></p>
          <p style="font-size:11px;color:#888">Ta wiadomość została wysłana automatycznie — prosimy na nią nie odpowiadać.</p>
        </div>`,
      });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "responseCode" in error ? Number(error.responseCode) : 0;
      // Explicit SMTP rejection means no acceptance; retry transient 4xx only.
      const status = code >= 400 && code < 500 ? "PENDING" : code >= 500 && code < 600 ? "FAILED" : "UNKNOWN";
      await prisma.$executeRaw`UPDATE "ReviewInvitation" SET status = ${status}, "nextAttemptAt" = NOW() + INTERVAL '1 hour'
        WHERE "bookingId" = ${bookingId} AND "recipientId" = ${recipient.id} AND status = 'SENDING'`;
      console.error("Review invitation failed", { bookingId, recipientId: recipient.id, status });
      continue;
    }
    // Outside the send catch: database failure after successful SMTP must not retry.
    await prisma.$executeRaw`UPDATE "ReviewInvitation" SET status = 'SENT', "sentAt" = NOW()
      WHERE "bookingId" = ${bookingId} AND "recipientId" = ${recipient.id} AND status = 'SENDING'`;
  }
}

export async function tryInviteBookingReview(bookingId: string) {
  try { await inviteBookingReview(bookingId); }
  catch { console.error("Review invitation deferred; scheduled job will check", { bookingId }); }
}

export async function processReviewInvitations() {
  const ids = await prisma.$queryRaw<{ id: string }[]>`
    SELECT b.id FROM "Booking" b WHERE b."reviewInvitationsEnabled" = true
    AND b.status = 'CONFIRMED' AND b."paymentStatus" = 'PAID' AND b."paidAt" IS NOT NULL
    AND b."endDate" < NOW() AND b."returnConfirmationStatus" IN ('CONFIRMED', 'AUTO_CONFIRMED')
    AND ((b."depositCents" = 0 AND b."depositStatus" = 'NONE') OR
      (b."settlementCompletedAt" IS NOT NULL AND b."depositStatus" IN ('REFUNDED','PARTIALLY_REFUNDED','RETAINED')))
    AND ((SELECT COUNT(*) FROM "ReviewInvitation" i WHERE i."bookingId" = b.id) < 2
      OR EXISTS (SELECT 1 FROM "ReviewInvitation" i WHERE i."bookingId" = b.id AND i.status = 'PENDING' AND i."nextAttemptAt" <= NOW()))
    ORDER BY b."endDate", b.id LIMIT 20`;
  for (const { id } of ids) await inviteBookingReview(id);
  return ids.length;
}
