ALTER TABLE "Listing" ADD COLUMN "sport" TEXT;
ALTER TABLE "Listing" ADD COLUMN "pregnancy" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Listing" ADD CONSTRAINT "Listing_pregnancy_gender_check"
  CHECK (NOT "pregnancy" OR ("gender" IS NOT NULL AND "gender" = 'WOMAN'));

CREATE INDEX "Listing_sport_idx" ON "Listing"("sport");
CREATE INDEX "Listing_pregnancy_idx" ON "Listing"("pregnancy");
