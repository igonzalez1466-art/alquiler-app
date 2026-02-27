/*
  Warnings:

  - The values [RETURN_PENDING,RETURNED] on the enum `ShippingStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."DeliveryConfirmationStatus" AS ENUM ('NOT_REQUESTED', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'DISPUTED', 'AUTO_CONFIRMED');

-- CreateEnum
CREATE TYPE "public"."DeliveryConfirmedBy" AS ENUM ('RENTER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."ReturnConfirmationStatus" AS ENUM ('NOT_REQUESTED', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'DISPUTED', 'AUTO_CONFIRMED');

-- CreateEnum
CREATE TYPE "public"."ReturnConfirmedBy" AS ENUM ('OWNER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."DamageClaimStatus" AS ENUM ('NONE', 'OPEN', 'CLAIMED', 'RESOLVED');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ShippingStatus_new" AS ENUM ('NOT_REQUIRED', 'PENDING', 'READY', 'SHIPPED', 'DELIVERED', 'LOST', 'CANCELLED');
ALTER TABLE "public"."Booking" ALTER COLUMN "returnStatus" DROP DEFAULT;
ALTER TABLE "public"."Booking" ALTER COLUMN "shippingStatus" DROP DEFAULT;
ALTER TABLE "public"."Booking" ALTER COLUMN "shippingStatus" TYPE "public"."ShippingStatus_new" USING ("shippingStatus"::text::"public"."ShippingStatus_new");
ALTER TABLE "public"."Booking" ALTER COLUMN "returnStatus" TYPE "public"."ShippingStatus_new" USING ("returnStatus"::text::"public"."ShippingStatus_new");
ALTER TYPE "public"."ShippingStatus" RENAME TO "ShippingStatus_old";
ALTER TYPE "public"."ShippingStatus_new" RENAME TO "ShippingStatus";
DROP TYPE "public"."ShippingStatus_old";
ALTER TABLE "public"."Booking" ALTER COLUMN "returnStatus" SET DEFAULT 'PENDING';
ALTER TABLE "public"."Booking" ALTER COLUMN "shippingStatus" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "damageClaimBy" TIMESTAMP(3),
ADD COLUMN     "damageClaimStatus" "public"."DamageClaimStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "deliveryConfirmBy" TIMESTAMP(3),
ADD COLUMN     "deliveryConfirmationStatus" "public"."DeliveryConfirmationStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN     "deliveryConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "deliveryConfirmedBy" "public"."DeliveryConfirmedBy",
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "returnConfirmBy" TIMESTAMP(3),
ADD COLUMN     "returnConfirmationStatus" "public"."ReturnConfirmationStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN     "returnConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "returnConfirmedBy" "public"."ReturnConfirmedBy",
ALTER COLUMN "returnStatus" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Booking_ownerId_idx" ON "public"."Booking"("ownerId");

-- CreateIndex
CREATE INDEX "Booking_deliveryConfirmationStatus_deliveryConfirmBy_idx" ON "public"."Booking"("deliveryConfirmationStatus", "deliveryConfirmBy");

-- CreateIndex
CREATE INDEX "Booking_returnConfirmationStatus_returnConfirmBy_idx" ON "public"."Booking"("returnConfirmationStatus", "returnConfirmBy");

-- CreateIndex
CREATE INDEX "Booking_damageClaimStatus_damageClaimBy_idx" ON "public"."Booking"("damageClaimStatus", "damageClaimBy");

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
