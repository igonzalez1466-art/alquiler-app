-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "depositDecisionAt" TIMESTAMP(3),
ADD COLUMN     "depositDecisionById" TEXT,
ADD COLUMN     "depositRetentionReason" TEXT,
ADD COLUMN     "paymentDueAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Booking_paymentDueAt_idx" ON "public"."Booking"("paymentDueAt");
