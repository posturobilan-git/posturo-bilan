-- AlterTable
ALTER TABLE "Study" ADD COLUMN     "followupToken" TEXT,
ADD COLUMN     "followupCompletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Study_followupToken_key" ON "Study"("followupToken");
