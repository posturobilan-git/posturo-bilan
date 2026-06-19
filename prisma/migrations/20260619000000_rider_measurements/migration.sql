-- AlterTable
ALTER TABLE "Study" ADD COLUMN     "riderMeasureValues" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "RiderMeasurement" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "category" "MeasurementCategory" NOT NULL DEFAULT 'POSITION',
    "isCommon" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "commonOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiderMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BikeTypeRiderMeasurement" (
    "bikeTypeId" TEXT NOT NULL,
    "riderMeasurementId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BikeTypeRiderMeasurement_pkey" PRIMARY KEY ("bikeTypeId","riderMeasurementId")
);

-- CreateIndex
CREATE INDEX "RiderMeasurement_createdById_idx" ON "RiderMeasurement"("createdById");

-- CreateIndex
CREATE INDEX "BikeTypeRiderMeasurement_riderMeasurementId_idx" ON "BikeTypeRiderMeasurement"("riderMeasurementId");

-- AddForeignKey
ALTER TABLE "RiderMeasurement" ADD CONSTRAINT "RiderMeasurement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BikeTypeRiderMeasurement" ADD CONSTRAINT "BikeTypeRiderMeasurement_bikeTypeId_fkey" FOREIGN KEY ("bikeTypeId") REFERENCES "BikeType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BikeTypeRiderMeasurement" ADD CONSTRAINT "BikeTypeRiderMeasurement_riderMeasurementId_fkey" FOREIGN KEY ("riderMeasurementId") REFERENCES "RiderMeasurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
