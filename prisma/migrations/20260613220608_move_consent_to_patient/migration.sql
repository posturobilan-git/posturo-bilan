-- AlterTable: move consent tracking from PatientIntake to Patient.
ALTER TABLE "PatientIntake" DROP COLUMN "consentAcceptedAt",
DROP COLUMN "consentVersion";

ALTER TABLE "Patient" ADD COLUMN     "consentAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT;
