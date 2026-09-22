ALTER TABLE "User"
  ADD COLUMN "preferredInpostPointCode" TEXT,
  ADD COLUMN "preferredInpostPointAddress" TEXT;

ALTER TABLE "Booking"
  ADD COLUMN "deliveryInpostPointCode" TEXT,
  ADD COLUMN "deliveryInpostPointAddress" TEXT,
  ADD COLUMN "returnInpostPointCode" TEXT,
  ADD COLUMN "returnInpostPointAddress" TEXT;
