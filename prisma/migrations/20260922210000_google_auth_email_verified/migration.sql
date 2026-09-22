-- Preserve existing verification state while adopting NextAuth's standard OAuth field type.
ALTER TABLE "User"
  ALTER COLUMN "emailVerified" DROP DEFAULT,
  ALTER COLUMN "emailVerified" TYPE TIMESTAMP(3)
  USING CASE WHEN "emailVerified" THEN CURRENT_TIMESTAMP ELSE NULL END;
