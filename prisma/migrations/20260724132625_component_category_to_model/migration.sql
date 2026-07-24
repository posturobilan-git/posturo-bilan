-- Convert ComponentCategory from a fixed enum into an admin-manageable model.
-- Hand-written (not auto-generated): backfilling categoryId from the old enum
-- value can't be derived automatically. See prisma/schema.prisma for the target
-- shape and the plan doc for the full rationale.

-- 1. New table (component_category is @@map-ed — a table can't share a name
--    with the still-live "ComponentCategory" enum type in the same schema).
--    legacyKey is temporary: it exists only to join old enum tags to new ids
--    during backfill, and is dropped at the very end of this migration.
CREATE TABLE "component_category" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "legacyKey" TEXT,

    CONSTRAINT "component_category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "component_category_name_key" ON "component_category"("name");
CREATE INDEX "component_category_createdById_idx" ON "component_category"("createdById");

ALTER TABLE "component_category" ADD CONSTRAINT "component_category_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Seed one row per existing enum value, owned by the earliest ADMIN account.
--    CROSS JOIN (not a scalar subquery) so a fresh database with no User rows
--    yet (first-ever deploy, CI, `migrate reset`) yields zero INSERTed rows
--    instead of NULL "createdById" values that would violate the NOT NULL
--    constraint below and abort the whole migration. On such a database there
--    are also zero BikeComponent/ComponentAttribute rows, so the backfill and
--    SET NOT NULL steps that follow succeed trivially with nothing to do; the
--    seed script creates the categories afterwards.
INSERT INTO "component_category" (id, "createdById", name, "order", "legacyKey", "updatedAt")
SELECT gen_random_uuid()::text, admin.id, v.name, v.ord, v.key, CURRENT_TIMESTAMP
FROM (VALUES
    ('Selle', 0, 'SELLE'),
    ('Potence', 1, 'POTENCE'),
    ('Cintre', 2, 'CINTRE'),
    ('Cale-pieds', 3, 'CALE_PIEDS'),
    ('Manivelles', 4, 'MANIVELLES'),
    ('Pédales', 5, 'PEDALES'),
    ('Autre', 6, 'AUTRE')
) AS v(name, ord, key)
CROSS JOIN (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1) AS admin;

-- 3. Nullable FK columns, backfilled via the legacyKey join, then made required.
ALTER TABLE "BikeComponent" ADD COLUMN "categoryId" TEXT;
UPDATE "BikeComponent" b SET "categoryId" = cc.id
    FROM "component_category" cc WHERE cc."legacyKey" = b."category"::text;
ALTER TABLE "BikeComponent" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "ComponentAttribute" ADD COLUMN "categoryId" TEXT;
UPDATE "ComponentAttribute" a SET "categoryId" = cc.id
    FROM "component_category" cc WHERE cc."legacyKey" = a."category"::text;
ALTER TABLE "ComponentAttribute" ALTER COLUMN "categoryId" SET NOT NULL;

-- 4. Drop the old enum-typed columns and constraints that depended on them.
DROP INDEX "BikeComponent_category_idx";
DROP INDEX "ComponentAttribute_category_idx";
DROP INDEX "ComponentAttribute_category_key_key";

ALTER TABLE "BikeComponent" DROP COLUMN "category";
ALTER TABLE "ComponentAttribute" DROP COLUMN "category";

-- 5. Now unused by any column — safe to drop the enum type itself.
DROP TYPE "ComponentCategory";

-- 6. New indexes/constraints on the FK columns (mirrors what `prisma migrate
--    diff` generates for this target schema).
CREATE INDEX "BikeComponent_categoryId_idx" ON "BikeComponent"("categoryId");
CREATE INDEX "ComponentAttribute_categoryId_idx" ON "ComponentAttribute"("categoryId");
CREATE UNIQUE INDEX "ComponentAttribute_categoryId_key_key" ON "ComponentAttribute"("categoryId", "key");

ALTER TABLE "BikeComponent" ADD CONSTRAINT "BikeComponent_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "component_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComponentAttribute" ADD CONSTRAINT "ComponentAttribute_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "component_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Drop the temporary backfill-only column.
ALTER TABLE "component_category" DROP COLUMN "legacyKey";
