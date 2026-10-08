ALTER TABLE "User"
 ADD COLUMN "identitySessionId" TEXT,
 ADD COLUMN "identityStatus" TEXT NOT NULL DEFAULT 'unverified',
 ADD COLUMN "identityVerifiedAt" TIMESTAMP(3),
 ADD COLUMN "identityLivemode" BOOLEAN,
 ADD COLUMN "identityAttempt" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "identityStartedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_identitySessionId_key" ON "User"("identitySessionId");
