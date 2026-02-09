/*
  Warnings:

  - The values [CHAMARRA] on the enum `GarmentType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."GarmentType_new" AS ENUM ('ABRIGO', 'CHAQUETA', 'MARYNARKA', 'CAMISA', 'BLUSA', 'VESTIDO', 'PANTALON', 'FALDA', 'TRAJE', 'SUDADERA', 'JERSEY', 'MONO', 'ACCESORIO', 'OTRO', 'ZAPATO');
ALTER TABLE "public"."Listing" ALTER COLUMN "garmentType" TYPE "public"."GarmentType_new" USING ("garmentType"::text::"public"."GarmentType_new");
ALTER TYPE "public"."GarmentType" RENAME TO "GarmentType_old";
ALTER TYPE "public"."GarmentType_new" RENAME TO "GarmentType";
DROP TYPE "public"."GarmentType_old";
COMMIT;
