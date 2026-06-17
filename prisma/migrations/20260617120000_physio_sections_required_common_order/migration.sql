-- AlterEnum: nouvelle valeur sémantique « positif / négatif » pour les tests physio
ALTER TYPE "PhysioOutputType" ADD VALUE 'POSITIVE_NEGATIVE';

-- AlterTable: côtes — obligatoire + ordre global du tronc commun
ALTER TABLE "Measurement" ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Measurement" ADD COLUMN "commonOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: tests physio — obligatoire + ordre global du tronc commun + section
ALTER TABLE "PhysioTest" ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PhysioTest" ADD COLUMN "commonOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PhysioTest" ADD COLUMN "sectionId" TEXT;

-- CreateTable: sections de tests physio
CREATE TABLE "PhysioTestSection" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysioTestSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhysioTestSection_createdById_idx" ON "PhysioTestSection"("createdById");

-- CreateIndex
CREATE INDEX "PhysioTest_sectionId_idx" ON "PhysioTest"("sectionId");

-- AddForeignKey
ALTER TABLE "PhysioTestSection" ADD CONSTRAINT "PhysioTestSection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysioTest" ADD CONSTRAINT "PhysioTest_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PhysioTestSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
