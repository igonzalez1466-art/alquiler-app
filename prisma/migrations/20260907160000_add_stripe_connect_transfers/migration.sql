-- AlterTable
ALTER TABLE "public"."Booking"
ADD COLUMN "depositTransferId" TEXT,
ADD COLUMN "depositTransferredAt" TIMESTAMP(3),
ADD COLUMN "depositTransferredCents" INTEGER,
ADD COLUMN "ownerTransferCents" INTEGER,
ADD COLUMN "ownerTransferId" TEXT,
ADD COLUMN "ownerTransferredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."User"
ADD COLUMN "stripeAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_ownerTransferId_key"
ON "public"."Booking"("ownerTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_depositTransferId_key"
ON "public"."Booking"("depositTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeAccountId_key"
ON "public"."User"("stripeAccountId");
