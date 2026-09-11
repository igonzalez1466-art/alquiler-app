BEGIN;
ALTER TABLE "Booking" ADD COLUMN "reviewInvitationsEnabled" BOOLEAN NOT NULL DEFAULT true;
-- Already eligible rentals are excluded once, at installation. No historical blast.
UPDATE "Booking" SET "reviewInvitationsEnabled" = false
WHERE status = 'CONFIRMED' AND "paymentStatus" = 'PAID' AND "paidAt" IS NOT NULL
AND "endDate" < NOW() AND "returnConfirmationStatus" IN ('CONFIRMED', 'AUTO_CONFIRMED')
AND (("depositCents" = 0 AND "depositStatus" = 'NONE') OR
  ("settlementCompletedAt" IS NOT NULL AND "depositStatus" IN ('REFUNDED','PARTIALLY_REFUNDED','RETAINED')));

CREATE TABLE "ReviewInvitation" (
  "bookingId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  "attemptedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("bookingId", "recipientId"),
  CONSTRAINT "ReviewInvitation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ReviewInvitation_status_nextAttemptAt_idx" ON "ReviewInvitation"(status, "nextAttemptAt");
COMMIT;
