ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "phoneVerificationTarget" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneVerificationSentAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
