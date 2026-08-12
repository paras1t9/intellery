/*
  Warnings:

  - The values [ARCFACE] on the enum `EmbeddingModel` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EmbeddingModel_new" AS ENUM ('W600K_R50');
ALTER TABLE "FaceVector" ALTER COLUMN "model" TYPE "EmbeddingModel_new" USING ("model"::text::"EmbeddingModel_new");
ALTER TYPE "EmbeddingModel" RENAME TO "EmbeddingModel_old";
ALTER TYPE "EmbeddingModel_new" RENAME TO "EmbeddingModel";
DROP TYPE "public"."EmbeddingModel_old";
COMMIT;
