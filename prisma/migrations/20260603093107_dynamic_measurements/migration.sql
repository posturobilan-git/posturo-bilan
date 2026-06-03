-- CreateEnum
CREATE TYPE "MeasurementCategory" AS ENUM ('SELLE', 'CINTRE', 'POTENCE', 'POSITION', 'CALE_PIEDS', 'MANIVELLES', 'AUTRE');

-- AlterTable
ALTER TABLE "Study" ADD COLUMN     "measureValues" JSONB NOT NULL DEFAULT '[]',
ALTER COLUMN "measures" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "category" "MeasurementCategory" NOT NULL DEFAULT 'AUTRE',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isCommon" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BikeTypeMeasurements" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BikeTypeMeasurements_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Measurement_createdById_idx" ON "Measurement"("createdById");

-- CreateIndex
CREATE INDEX "_BikeTypeMeasurements_B_index" ON "_BikeTypeMeasurements"("B");

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BikeTypeMeasurements" ADD CONSTRAINT "_BikeTypeMeasurements_A_fkey" FOREIGN KEY ("A") REFERENCES "BikeType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BikeTypeMeasurements" ADD CONSTRAINT "_BikeTypeMeasurements_B_fkey" FOREIGN KEY ("B") REFERENCES "Measurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

