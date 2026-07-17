-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailHash" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "emailHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_emailHash_key" ON "User"("emailHash");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_emailHash_key" ON "Patient"("emailHash");
