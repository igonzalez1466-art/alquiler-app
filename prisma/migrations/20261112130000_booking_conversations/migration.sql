BEGIN;
ALTER TABLE "Conversation" ADD COLUMN "bookingId" TEXT;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Conversation_bookingId_key" ON "Conversation"("bookingId");
DROP INDEX "Conversation_listingId_buyerId_key";
CREATE UNIQUE INDEX "Conversation_listing_inquiry_key" ON "Conversation"("listingId", "buyerId") WHERE "bookingId" IS NULL;
COMMIT;
