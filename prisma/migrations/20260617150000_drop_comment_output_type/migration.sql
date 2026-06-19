-- Le type de réponse « Commentaire » (texte comme résultat) est supprimé : la
-- description du test et une note libre optionnelle sont désormais gérées hors
-- outputType. Les tests existants en COMMENT (observationnels) basculent vers
-- POSITIVE_NEGATIVE (signe clinique présent/absent) ; l'admin peut les retyper.

-- 1) Migrer les lignes hors de la valeur supprimée.
UPDATE "PhysioTest" SET "outputType" = 'POSITIVE_NEGATIVE' WHERE "outputType" = 'COMMENT';

-- 2) Recréer l'enum sans la valeur COMMENT (Postgres ne sait pas DROP VALUE).
ALTER TYPE "PhysioOutputType" RENAME TO "PhysioOutputType_old";
CREATE TYPE "PhysioOutputType" AS ENUM ('YES_NO', 'POSITIVE_NEGATIVE', 'VALUE');
ALTER TABLE "PhysioTest" ALTER COLUMN "outputType" DROP DEFAULT;
ALTER TABLE "PhysioTest" ALTER COLUMN "outputType" TYPE "PhysioOutputType" USING ("outputType"::text::"PhysioOutputType");
ALTER TABLE "PhysioTest" ALTER COLUMN "outputType" SET DEFAULT 'VALUE';
DROP TYPE "PhysioOutputType_old";
