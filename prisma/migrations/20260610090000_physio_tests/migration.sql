-- CreateEnum
CREATE TYPE "PhysioOutputType" AS ENUM ('YES_NO', 'COMMENT', 'VALUE');

-- AlterTable
ALTER TABLE "Study" ADD COLUMN     "physioResults" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "PhysioTest" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "outputType" "PhysioOutputType" NOT NULL DEFAULT 'VALUE',
    "unit" TEXT,
    "isCommon" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysioTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BikeTypePhysioTest" (
    "bikeTypeId" TEXT NOT NULL,
    "physioTestId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BikeTypePhysioTest_pkey" PRIMARY KEY ("bikeTypeId","physioTestId")
);

-- CreateIndex
CREATE INDEX "PhysioTest_createdById_idx" ON "PhysioTest"("createdById");

-- CreateIndex
CREATE INDEX "BikeTypePhysioTest_physioTestId_idx" ON "BikeTypePhysioTest"("physioTestId");

-- AddForeignKey
ALTER TABLE "PhysioTest" ADD CONSTRAINT "PhysioTest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BikeTypePhysioTest" ADD CONSTRAINT "BikeTypePhysioTest_bikeTypeId_fkey" FOREIGN KEY ("bikeTypeId") REFERENCES "BikeType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BikeTypePhysioTest" ADD CONSTRAINT "BikeTypePhysioTest_physioTestId_fkey" FOREIGN KEY ("physioTestId") REFERENCES "PhysioTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
