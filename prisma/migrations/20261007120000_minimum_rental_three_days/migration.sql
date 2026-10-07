-- Apply the new listing minimum to future bookings; existing Booking snapshots remain unchanged.
UPDATE "Listing" SET "minimumRentalDays" = 3 WHERE "minimumRentalDays" < 3;
ALTER TABLE "Listing" ALTER COLUMN "minimumRentalDays" SET DEFAULT 3;
ALTER TABLE "Listing" DROP CONSTRAINT IF EXISTS "Listing_minimumRentalDays_positive";
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_minimumRentalDays_at_least_three" CHECK ("minimumRentalDays" >= 3);
