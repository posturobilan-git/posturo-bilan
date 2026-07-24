-- CreateEnum
CREATE TYPE "ComponentAttributeType" AS ENUM ('NUMBER', 'TEXT', 'BOOLEAN', 'SELECT');

-- CreateTable
CREATE TABLE "ComponentAttribute" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "category" "ComponentCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "ComponentAttributeType" NOT NULL DEFAULT 'TEXT',
    "unit" TEXT,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentAttributeValue" (
    "componentId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueBoolean" BOOLEAN,

    CONSTRAINT "ComponentAttributeValue_pkey" PRIMARY KEY ("componentId","attributeId")
);

-- CreateIndex
CREATE INDEX "ComponentAttribute_createdById_idx" ON "ComponentAttribute"("createdById");

-- CreateIndex
CREATE INDEX "ComponentAttribute_category_idx" ON "ComponentAttribute"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentAttribute_category_key_key" ON "ComponentAttribute"("category", "key");

-- CreateIndex
CREATE INDEX "ComponentAttributeValue_attributeId_idx" ON "ComponentAttributeValue"("attributeId");

-- AddForeignKey
ALTER TABLE "ComponentAttribute" ADD CONSTRAINT "ComponentAttribute_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentAttributeValue" ADD CONSTRAINT "ComponentAttributeValue_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "BikeComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentAttributeValue" ADD CONSTRAINT "ComponentAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "ComponentAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
