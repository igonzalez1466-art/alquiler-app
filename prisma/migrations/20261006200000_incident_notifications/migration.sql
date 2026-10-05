-- CreateTable
CREATE TABLE "public"."IncidentNotification" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "IncidentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IncidentNotification_eventKey_key" ON "public"."IncidentNotification"("eventKey");

-- CreateIndex
CREATE INDEX "IncidentNotification_sentAt_nextAttemptAt_idx" ON "public"."IncidentNotification"("sentAt", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "IncidentNotification_incidentId_createdAt_idx" ON "public"."IncidentNotification"("incidentId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."IncidentNotification" ADD CONSTRAINT "IncidentNotification_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "public"."Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

