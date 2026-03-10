/*
  Warnings:

  - The values [HELD,RELEASED,CAPTURED] on the enum `DepositStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."DepositStatus_new" AS ENUM ('NONE', 'PENDING', 'PAID', 'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED', 'RETAINED', 'FAILED');
ALTER TABLE "public"."Booking" ALTER COLUMN "depositStatus" DROP DEFAULT;
ALTER TABLE "public"."Booking" ALTER COLUMN "depositStatus" TYPE "public"."DepositStatus_new" USING ("depositStatus"::text::"public"."DepositStatus_new");
ALTER TYPE "public"."DepositStatus" RENAME TO "DepositStatus_old";
ALTER TYPE "public"."DepositStatus_new" RENAME TO "DepositStatus";
DROP TYPE "public"."DepositStatus_old";
ALTER TABLE "public"."Booking" ALTER COLUMN "depositStatus" SET DEFAULT 'NONE';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "depositChargeId" TEXT,
ADD COLUMN     "depositLastError" TEXT,
ADD COLUMN     "depositPaidAt" TIMESTAMP(3),
ADD COLUMN     "depositRefundId" TEXT,
ADD COLUMN     "depositRefundedAt" TIMESTAMP(3),
ADD COLUMN     "depositRefundedCents" INTEGER,
ADD COLUMN     "depositReleaseAt" TIMESTAMP(3),
ADD COLUMN     "depositRetainedCents" INTEGER;

-- CreateIndex
CREATE INDEX "Booking_depositStatus_idx" ON "public"."Booking"("depositStatus");

-- CreateIndex
CREATE INDEX "Booking_depositReleaseAt_idx" ON "public"."Booking"("depositReleaseAt");
