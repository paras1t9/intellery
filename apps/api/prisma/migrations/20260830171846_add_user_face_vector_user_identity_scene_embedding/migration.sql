/*
  Warnings:

  - Added the required column `updatedAt` to the `PhotoAnnotation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SceneEmbeddingModel" AS ENUM ('CLIP_VIT_B32');

-- AlterTable
ALTER TABLE "PhotoAnnotation" ADD COLUMN     "sceneModel" "SceneEmbeddingModel",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "vector" vector(512);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "selfieKey" TEXT;

-- CreateTable
CREATE TABLE "UserFaceVector" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vector" vector(512) NOT NULL,
    "model" "EmbeddingModel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFaceVector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("userId","eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserFaceVector_userId_key" ON "UserFaceVector"("userId");

-- CreateIndex
CREATE INDEX "UserIdentity_eventId_idx" ON "UserIdentity"("eventId");

-- CreateIndex
CREATE INDEX "UserIdentity_identityId_idx" ON "UserIdentity"("identityId");

-- AddForeignKey
ALTER TABLE "UserFaceVector" ADD CONSTRAINT "UserFaceVector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
