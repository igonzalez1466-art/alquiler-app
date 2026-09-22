-- Existing unpaid reservations were accepted with a two-hour deadline.
-- Extend only active payment windows by ten hours so they also receive
-- twelve hours from the original acceptance time.
UPDATE "Booking"
SET "paymentDueAt" = "paymentDueAt" + INTERVAL '10 hours'
WHERE "status" = 'AWAITING_PAYMENT'
  AND "paymentStatus" = 'PENDING'
  AND "paidAt" IS NULL
  AND "paymentDueAt" IS NOT NULL;
