-- CreateEnum
CREATE TYPE "PhotoPhase" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "PhotoAngle" AS ENUM ('SIDE', 'FRONT', 'BACK');

-- CreateTable
CREATE TABLE "StudyPhoto" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "phase" "PhotoPhase" NOT NULL,
    "angle" "PhotoAngle",
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyPhoto_studyId_idx" ON "StudyPhoto"("studyId");

-- AddForeignKey
ALTER TABLE "StudyPhoto" ADD CONSTRAINT "StudyPhoto_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;
