CREATE TYPE "BookingEvidenceStage" AS ENUM ('DELIVERY', 'RETURN');

CREATE TABLE "BookingEvidencePhoto" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "stage" "BookingEvidenceStage" NOT NULL,
    "slot" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingEvidencePhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingEvidencePhoto_bookingId_stage_createdAt_idx" ON "BookingEvidencePhoto"("bookingId", "stage", "createdAt");
CREATE UNIQUE INDEX "BookingEvidencePhoto_bookingId_stage_uploaderId_slot_key" ON "BookingEvidencePhoto"("bookingId", "stage", "uploaderId", "slot");

ALTER TABLE "BookingEvidencePhoto" ADD CONSTRAINT "BookingEvidencePhoto_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
