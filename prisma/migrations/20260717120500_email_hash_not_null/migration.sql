-- AlterTable
ALTER TABLE "User" ALTER COLUMN "emailHash" SET NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "emailHash" SET NOT NULL;
