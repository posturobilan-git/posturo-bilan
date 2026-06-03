-- CreateTable
CREATE TABLE "BikeTypeMeasurement" (
    "bikeTypeId" TEXT NOT NULL,
    "measurementId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BikeTypeMeasurement_pkey" PRIMARY KEY ("bikeTypeId","measurementId")
);

-- CreateIndex
CREATE INDEX "BikeTypeMeasurement_measurementId_idx" ON "BikeTypeMeasurement"("measurementId");

-- AddForeignKey
ALTER TABLE "BikeTypeMeasurement" ADD CONSTRAINT "BikeTypeMeasurement_bikeTypeId_fkey" FOREIGN KEY ("bikeTypeId") REFERENCES "BikeType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BikeTypeMeasurement" ADD CONSTRAINT "BikeTypeMeasurement_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "Measurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing implicit côte ↔ bike-type links into the explicit join table,
-- carrying over the old global Measurement.order as each link's per-bike-type order
-- (A = BikeType.id, B = Measurement.id in the implicit relation table).
INSERT INTO "BikeTypeMeasurement" ("bikeTypeId", "measurementId", "order")
SELECT j."A", j."B", COALESCE(m."order", 0)
FROM "_BikeTypeMeasurements" j
JOIN "Measurement" m ON m."id" = j."B";

-- DropForeignKey / DropTable (old implicit relation table)
ALTER TABLE "_BikeTypeMeasurements" DROP CONSTRAINT "_BikeTypeMeasurements_A_fkey";
ALTER TABLE "_BikeTypeMeasurements" DROP CONSTRAINT "_BikeTypeMeasurements_B_fkey";
DROP TABLE "_BikeTypeMeasurements";

-- DropColumn (global order replaced by per-bike-type order)
ALTER TABLE "Measurement" DROP COLUMN "order";
