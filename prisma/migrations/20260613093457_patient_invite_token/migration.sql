-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "inviteToken" TEXT,
ADD COLUMN     "inviteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "inviteSentAt" TIMESTAMP(3),
ADD COLUMN     "inviteCompletedAt" TIMESTAMP(3);

-- Backfill existing patients with a fresh invite token valid for 30 days so
-- their accueil link works retroactively.
UPDATE "Patient"
SET "inviteToken" = gen_random_uuid()::text,
    "inviteExpiresAt" = "createdAt" + INTERVAL '30 days'
WHERE "inviteToken" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Patient_inviteToken_key" ON "Patient"("inviteToken");
