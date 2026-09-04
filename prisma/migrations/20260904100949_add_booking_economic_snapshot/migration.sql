-- CreateEnum
CREATE TYPE "public"."DepositRetentionReasonCode" AS ENUM ('DAMAGE', 'STAINING', 'MISSING_ITEM', 'LATE_RETURN', 'CLEANING', 'OTHER');

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "ownerPayoutCents" INTEGER,
ADD COLUMN     "platformFeeCents" INTEGER,
ADD COLUMN     "platformFeeRate" INTEGER,
ADD COLUMN     "pricePerDayCents" INTEGER,
ADD COLUMN     "rentAmountCents" INTEGER;
