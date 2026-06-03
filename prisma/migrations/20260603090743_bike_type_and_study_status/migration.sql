-- Refacto structurel : type de vélo + multi-études.
-- Le statut du cycle de vie passe du Patient vers l'étude (Study).
-- Migration NON destructive : la table "PostureStudy" est renommée en "Study"
-- (les données des études existantes sont préservées), un type de vélo est
-- backfillé sur chaque étude, et le statut patient est reporté sur ses études.

-- ─── Nouveau type d'énumération ───────────────────────────────────────────────
CREATE TYPE "StudyStatus" AS ENUM ('study_pending', 'study_completed', 'report_sent', 'followup_pending', 'followup_completed');

-- ─── Nouvelle table BikeType ──────────────────────────────────────────────────
CREATE TABLE "BikeType" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BikeType_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BikeType_createdById_idx" ON "BikeType"("createdById");
ALTER TABLE "BikeType" ADD CONSTRAINT "BikeType_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed des types de vélo de base, attribués au plus ancien ADMIN.
-- Sans ADMIN (ex : base de shadow vide), n'insère rien — sans erreur.
INSERT INTO "BikeType" ("id", "createdById", "name", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u.id, t.name, true, NOW(), NOW()
FROM (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1) u
CROSS JOIN (VALUES ('Route'), ('VTT'), ('Gravel'), ('Triathlon'), ('Piste')) AS t(name);

-- ─── Renommage PostureStudy → Study (préserve les lignes) ─────────────────────
ALTER TABLE "PostureStudy" RENAME TO "Study";
ALTER TABLE "Study" RENAME CONSTRAINT "PostureStudy_pkey" TO "Study_pkey";
ALTER TABLE "Study" RENAME CONSTRAINT "PostureStudy_patientId_fkey" TO "Study_patientId_fkey";
ALTER TABLE "Study" RENAME CONSTRAINT "PostureStudy_kineId_fkey" TO "Study_kineId_fkey";
ALTER INDEX "PostureStudy_patientId_idx" RENAME TO "Study_patientId_idx";
ALTER INDEX "PostureStudy_kineId_idx" RENAME TO "Study_kineId_idx";

-- ─── Study.bikeTypeId (ajout nullable, backfill, puis NOT NULL) ───────────────
ALTER TABLE "Study" ADD COLUMN "bikeTypeId" TEXT;

-- Backfill : associe chaque étude au type de vélo correspondant à l'intake du
-- patient (matching insensible à la casse), avec repli sur "Route".
UPDATE "Study" s SET "bikeTypeId" = COALESCE(
  (SELECT bt.id FROM "BikeType" bt
     JOIN "PatientIntake" pi ON pi."patientId" = s."patientId"
    WHERE pi."bikeType" IS NOT NULL AND LOWER(bt.name) = LOWER(pi."bikeType")
    LIMIT 1),
  (SELECT id FROM "BikeType" WHERE name = 'Route' LIMIT 1)
)
WHERE "bikeTypeId" IS NULL;

ALTER TABLE "Study" ALTER COLUMN "bikeTypeId" SET NOT NULL;
CREATE INDEX "Study_bikeTypeId_idx" ON "Study"("bikeTypeId");
ALTER TABLE "Study" ADD CONSTRAINT "Study_bikeTypeId_fkey" FOREIGN KEY ("bikeTypeId") REFERENCES "BikeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Study.status (report depuis Patient.status) ──────────────────────────────
ALTER TABLE "Study" ADD COLUMN "status" "StudyStatus" NOT NULL DEFAULT 'study_pending';

UPDATE "Study" s SET "status" = (
  CASE p."status"::text
    WHEN 'report_sent' THEN 'report_sent'
    WHEN 'followup_pending' THEN 'followup_pending'
    WHEN 'followup_completed' THEN 'followup_completed'
    WHEN 'study_completed' THEN 'study_completed'
    ELSE 'study_pending'
  END
)::"StudyStatus"
FROM "Patient" p
WHERE s."patientId" = p.id;

CREATE INDEX "Study_status_idx" ON "Study"("status");

-- ─── Suppression de Patient.status ────────────────────────────────────────────
DROP INDEX "Patient_status_idx";
ALTER TABLE "Patient" DROP COLUMN "status";
DROP TYPE "PatientStatus";
