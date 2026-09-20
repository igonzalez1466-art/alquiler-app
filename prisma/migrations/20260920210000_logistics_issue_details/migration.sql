-- Optional metadata preserves the existing logistics and payment enums.
-- Existing disputes remain valid and can be closed by their stage's recipient.
ALTER TABLE "Booking"
  ADD COLUMN "deliveryIssue" JSONB,
  ADD COLUMN "returnIssue" JSONB;
