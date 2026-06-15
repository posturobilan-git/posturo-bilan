-- AlterTable
ALTER TABLE "PatientIntake" ADD COLUMN     "consentAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT;
