-- AlterTable
ALTER TABLE "Study" ADD COLUMN     "recommendations" TEXT,
ADD COLUMN     "summary" TEXT;

-- CreateTable
CREATE TABLE "StudyPain" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "type" TEXT,
    "intensity" TEXT,
    "restAtRest" BOOLEAN NOT NULL DEFAULT false,
    "activity" TEXT,
    "duration" TEXT,
    "aggravatingFactors" TEXT,
    "relievingFactors" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyPain_studyId_idx" ON "StudyPain"("studyId");

-- AddForeignKey
ALTER TABLE "StudyPain" ADD CONSTRAINT "StudyPain_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;
