-- CreateEnum
CREATE TYPE "public"."IncidentStage" AS ENUM ('DELIVERY', 'RETURN');

-- CreateEnum
CREATE TYPE "public"."IncidentReason" AS ENUM ('NOT_SHIPPED', 'NOT_RECEIVED', 'NOT_AS_DESCRIBED', 'DAMAGED_ON_ARRIVAL', 'LATE_DELIVERY', 'RETURN_NOT_RECEIVED', 'DAMAGED_ON_RETURN', 'LATE_RETURN', 'NOT_RETURNED', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."IncidentStatus" AS ENUM ('OPEN', 'AWAITING_OWNER', 'AWAITING_RENTER', 'AGREEMENT_REACHED', 'ESCALATED', 'RESOLVED');

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "rentRefundedCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rentSettlement" JSONB;

-- CreateTable
CREATE TABLE "public"."Incident" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "againstUserId" TEXT NOT NULL,
    "stage" "public"."IncidentStage" NOT NULL,
    "reason" "public"."IncidentReason" NOT NULL,
    "status" "public"."IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseDueAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "refundCents" INTEGER,
    "proposedById" TEXT,
    "proposedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "refundId" TEXT,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IncidentEvidence" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Incident_refundId_key" ON "public"."Incident"("refundId");

-- CreateIndex
CREATE INDEX "Incident_againstUserId_status_idx" ON "public"."Incident"("againstUserId", "status");

-- CreateIndex
CREATE INDEX "Incident_openedById_status_idx" ON "public"."Incident"("openedById", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_bookingId_stage_key" ON "public"."Incident"("bookingId", "stage");

-- CreateIndex
CREATE INDEX "IncidentEvidence_incidentId_createdAt_idx" ON "public"."IncidentEvidence"("incidentId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_againstUserId_fkey" FOREIGN KEY ("againstUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IncidentEvidence" ADD CONSTRAINT "IncidentEvidence_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "public"."Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IncidentEvidence" ADD CONSTRAINT "IncidentEvidence_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "bookingRestrictedAt" TIMESTAMP(3),
ADD COLUMN     "bookingRestrictionReason" TEXT;

-- Return cases cannot authorize deductions or refunds of earned rental income.
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_return_no_refund"
CHECK ("refundCents" IS NULL OR ("refundCents" >= 0 AND ("stage" <> 'RETURN' OR "refundCents" = 0)));
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_rent_refunded_nonnegative" CHECK ("rentRefundedCents" >= 0);
