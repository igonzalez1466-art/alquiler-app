ALTER TABLE "Listing" ADD COLUMN "minimumRentalDays" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_minimumRentalDays_positive" CHECK ("minimumRentalDays" >= 1);
