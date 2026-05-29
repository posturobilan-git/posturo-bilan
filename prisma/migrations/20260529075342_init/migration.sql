-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'KINE');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('intake_pending', 'intake_completed', 'study_pending', 'study_completed', 'report_sent', 'followup_pending', 'followup_completed');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'VIEW_SENSITIVE', 'EXPORT', 'ANONYMIZE');

-- CreateEnum
CREATE TYPE "ComponentCategory" AS ENUM ('SELLE', 'POTENCE', 'CINTRE', 'CALE_PIEDS', 'MANIVELLES', 'PEDALES', 'AUTRE');

-- CreateEnum
CREATE TYPE "ExerciseCategory" AS ENUM ('SOUPLESSE', 'RENFORCEMENT', 'MOBILITE', 'PROPRIOCEPTION', 'AUTRE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'KINE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "kineId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "calendlyEventId" TEXT,
    "status" "PatientStatus" NOT NULL DEFAULT 'intake_pending',
    "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientIntake" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "bikeType" TEXT,
    "ridingLevel" TEXT,
    "weeklyHours" DOUBLE PRECISION,
    "yearsRiding" INTEGER,
    "injuries" TEXT[],
    "goals" TEXT,
    "medicalNotes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'google_forms',
    "rawData" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientIntake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostureStudy" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "kineId" TEXT NOT NULL,
    "measures" JSONB NOT NULL,
    "reportUrl" TEXT,
    "reportSentAt" TIMESTAMP(3),
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostureStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Followup" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "painLevel" INTEGER,
    "comfortScore" INTEGER,
    "satisfactionScore" INTEGER,
    "ridingFrequency" TEXT,
    "returningToSport" BOOLEAN,
    "generalFeedback" TEXT,
    "source" TEXT NOT NULL DEFAULT 'google_forms',
    "rawResponses" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Followup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ExerciseCategory" NOT NULL DEFAULT 'AUTRE',
    "frequency" TEXT,
    "duration" TEXT,
    "mediaUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BikeComponent" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "category" "ComponentCategory" NOT NULL DEFAULT 'AUTRE',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BikeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_StudyExercises" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_StudyExercises_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_StudyComponents" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_StudyComponents_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_clerkId_idx" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_email_key" ON "Patient"("email");

-- CreateIndex
CREATE INDEX "Patient_kineId_idx" ON "Patient"("kineId");

-- CreateIndex
CREATE INDEX "Patient_status_idx" ON "Patient"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PatientIntake_patientId_key" ON "PatientIntake"("patientId");

-- CreateIndex
CREATE INDEX "PostureStudy_patientId_idx" ON "PostureStudy"("patientId");

-- CreateIndex
CREATE INDEX "PostureStudy_kineId_idx" ON "PostureStudy"("kineId");

-- CreateIndex
CREATE INDEX "Followup_patientId_idx" ON "Followup"("patientId");

-- CreateIndex
CREATE INDEX "Exercise_createdById_idx" ON "Exercise"("createdById");

-- CreateIndex
CREATE INDEX "BikeComponent_createdById_idx" ON "BikeComponent"("createdById");

-- CreateIndex
CREATE INDEX "BikeComponent_category_idx" ON "BikeComponent"("category");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "_StudyExercises_B_index" ON "_StudyExercises"("B");

-- CreateIndex
CREATE INDEX "_StudyComponents_B_index" ON "_StudyComponents"("B");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_kineId_fkey" FOREIGN KEY ("kineId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientIntake" ADD CONSTRAINT "PatientIntake_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostureStudy" ADD CONSTRAINT "PostureStudy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostureStudy" ADD CONSTRAINT "PostureStudy_kineId_fkey" FOREIGN KEY ("kineId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Followup" ADD CONSTRAINT "Followup_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BikeComponent" ADD CONSTRAINT "BikeComponent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StudyExercises" ADD CONSTRAINT "_StudyExercises_A_fkey" FOREIGN KEY ("A") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StudyExercises" ADD CONSTRAINT "_StudyExercises_B_fkey" FOREIGN KEY ("B") REFERENCES "PostureStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StudyComponents" ADD CONSTRAINT "_StudyComponents_A_fkey" FOREIGN KEY ("A") REFERENCES "BikeComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StudyComponents" ADD CONSTRAINT "_StudyComponents_B_fkey" FOREIGN KEY ("B") REFERENCES "PostureStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
