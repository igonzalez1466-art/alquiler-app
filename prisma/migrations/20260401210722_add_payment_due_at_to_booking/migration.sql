ALTER TABLE "public"."Booking"
ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paymentDueAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Booking_paymentDueAt_idx" ON "public"."Booking"("paymentDueAt");