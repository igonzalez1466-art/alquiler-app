-- CreateEnum
CREATE TYPE "public"."DepositStatus" AS ENUM ('NONE', 'HELD', 'RELEASED', 'CAPTURED');

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "depositPaymentIntentId" TEXT,
ADD COLUMN     "depositStatus" "public"."DepositStatus" NOT NULL DEFAULT 'NONE';
