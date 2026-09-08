-- Additive migration. Never rewrite completed settlements or Stripe IDs.
ALTER TABLE "public"."Booking"
ADD COLUMN "settlementDecision" JSONB,
ADD COLUMN "settlementCompletedAt" TIMESTAMP(3),
ADD COLUMN "settlementLegacyReview" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "public"."SettlementOperation" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "params" JSONB NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "startedAt" TIMESTAMP(3),
  "stripeId" TEXT,
  "amount" INTEGER,
  "lastErrorCode" TEXT,
  CONSTRAINT "SettlementOperation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SettlementOperation_bookingId_fkey" FOREIGN KEY ("bookingId")
    REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SettlementOperation_bookingId_kind_key" ON "public"."SettlementOperation"("bookingId", "kind");
CREATE UNIQUE INDEX "SettlementOperation_stripeId_key" ON "public"."SettlementOperation"("stripeId");

-- Pre-journal unfinished paid deposits may already have Stripe side effects
-- without saved IDs. Require reconciliation instead of using a fresh key.
UPDATE "public"."Booking" SET "settlementLegacyReview" = true
WHERE "paymentStatus" = 'PAID' AND "depositDecisionAt" IS NULL
  AND "depositStatus" IN ('PAID', 'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED');
