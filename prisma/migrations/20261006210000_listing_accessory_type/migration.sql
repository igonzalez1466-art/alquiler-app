ALTER TABLE "Listing" ADD COLUMN "accessoryType" TEXT;
CREATE INDEX "Listing_accessoryType_idx" ON "Listing"("accessoryType");
