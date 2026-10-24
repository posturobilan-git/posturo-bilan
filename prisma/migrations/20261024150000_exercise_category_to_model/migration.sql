-- Convert ExerciseCategory from a fixed enum into an admin-manageable model
-- (prompt 28, point 2). Hand-written, like the ComponentCategory conversion:
-- backfilling categoryId from the old enum value can't be derived automatically.
-- Lossless: one category row per enum value, every existing exercise re-attached.

-- 1. New table (exercise_category is @@map-ed — a table can't share a name with
--    the still-live "ExerciseCategory" enum type in the same schema).
--    legacyKey is temporary: it exists only to join old enum tags to new ids
--    during the backfill, and is dropped at the very end of this migration.
CREATE TABLE "exercise_category" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "legacyKey" TEXT,

    CONSTRAINT "exercise_category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exercise_category_name_key" ON "exercise_category"("name");
CREATE INDEX "exercise_category_createdById_idx" ON "exercise_category"("createdById");

ALTER TABLE "exercise_category" ADD CONSTRAINT "exercise_category_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Seed one row per existing enum value (even an unused one), owned by the
--    earliest ADMIN account (any account if there is none yet). CROSS JOIN, not
--    a scalar subquery, so a fresh database with no User row yields zero rows
--    instead of a NULL "createdById" that would abort the migration; such a
--    database has no Exercise either, so the backfill below has nothing to do
--    and the seed script creates the categories afterwards.
INSERT INTO "exercise_category" (id, "createdById", name, "order", "legacyKey", "updatedAt")
SELECT gen_random_uuid()::text, owner.id, v.name, v.ord, v.key, CURRENT_TIMESTAMP
FROM (VALUES
    ('Souplesse', 0, 'SOUPLESSE'),
    ('Renforcement', 1, 'RENFORCEMENT'),
    ('Mobilité', 2, 'MOBILITE'),
    ('Proprioception', 3, 'PROPRIOCEPTION'),
    ('Autre', 4, 'AUTRE')
) AS v(name, ord, key)
CROSS JOIN (
    SELECT id FROM "User" ORDER BY (role = 'ADMIN') DESC, "createdAt" ASC LIMIT 1
) AS owner;

-- 3. Nullable FK column, backfilled via the legacyKey join, then made required.
ALTER TABLE "Exercise" ADD COLUMN "categoryId" TEXT;
UPDATE "Exercise" e SET "categoryId" = c.id
    FROM "exercise_category" c WHERE c."legacyKey" = e."category"::text;
ALTER TABLE "Exercise" ALTER COLUMN "categoryId" SET NOT NULL;

-- 4. Drop the old enum-typed column, then the enum type itself (no longer used).
ALTER TABLE "Exercise" DROP COLUMN "category";
DROP TYPE "ExerciseCategory";

-- 5. Index + foreign key on the new column (mirrors `prisma migrate diff`).
CREATE INDEX "Exercise_categoryId_idx" ON "Exercise"("categoryId");
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "exercise_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Drop the temporary backfill-only column.
ALTER TABLE "exercise_category" DROP COLUMN "legacyKey";
