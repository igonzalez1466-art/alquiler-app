-- Existing paid bookings should no longer require a separate point confirmation.
-- Do not alter destinations once a parcel has been sent or when a booking override exists.
UPDATE "Booking" AS booking
SET "deliveryInpostPointCode" = renter."preferredInpostPointCode",
    "deliveryInpostPointAddress" = renter."preferredInpostPointAddress"
FROM "User" AS renter
WHERE booking."renterId" = renter."id"
  AND booking."paymentStatus" = 'PAID'
  AND booking."status" <> 'CANCELLED'
  AND booking."shippingStatus" IN ('PENDING', 'READY')
  AND booking."deliveryInpostPointCode" IS NULL
  AND renter."preferredInpostPointCode" IS NOT NULL;

UPDATE "Booking" AS booking
SET "returnInpostPointCode" = owner."preferredInpostPointCode",
    "returnInpostPointAddress" = owner."preferredInpostPointAddress"
FROM "User" AS owner
WHERE booking."ownerId" = owner."id"
  AND booking."paymentStatus" = 'PAID'
  AND booking."status" <> 'CANCELLED'
  AND booking."returnStatus" IN ('PENDING', 'READY')
  AND booking."returnInpostPointCode" IS NULL
  AND owner."preferredInpostPointCode" IS NOT NULL;
