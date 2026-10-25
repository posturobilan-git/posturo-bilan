-- Tronc commun réordonnable librement, ordre propre à chaque type de vélo
-- (prompt 28, point 1 — remplace le point 4 du prompt 21).
--
-- Avant : un élément commun n'avait pas de lien avec les types de vélo ; il
-- s'affichait toujours en premier, dans un ordre global (`commonOrder`), puis
-- venaient les éléments liés au type (`order` des tables de liaison).
-- Après : chaque type de vélo porte UNE liste ordonnée (colonne `order` des
-- tables de liaison) qui inclut le tronc commun. Un élément commun a donc un
-- lien (et une position) sur CHAQUE type de vélo ; il reste présent partout.
--
-- Migration de données seule — aucun changement de schéma. L'ordre de chaque
-- type est initialisé depuis l'ordre actuel (communs par `commonOrder` puis
-- nom, suivis des spécifiques par `order` puis nom) : rien ne bouge tant que
-- l'admin ne réordonne pas. `commonOrder` est conservé : c'est désormais
-- l'ordre par défaut du tronc commun, point de départ d'un nouveau type de vélo.
--
-- Départage des ex æquo : par nom, avec le collationnement ICU (`und-x-icu`) —
-- celui de `localeCompare`, que le formulaire d'étude utilisait jusqu'ici. Le
-- collationnement par défaut du serveur est binaire (majuscules avant minuscules,
-- accents en dernier) et ferait bouger des éléments à `commonOrder` identique.
--
-- Même traitement pour les trois familles : côtes, mesures du cycliste, tests
-- physio. Les communs inactifs sont inclus (une réactivation retrouve sa place).
-- Les CROSS JOIN ne produisent aucune ligne quand une table est vide (base neuve).

-- ── Côtes ─────────────────────────────────────────────────────────────────────

-- Un commun n'avait pas de lien ; on écarte d'éventuels résidus avant de renuméroter.
DELETE FROM "BikeTypeMeasurement"
WHERE "measurementId" IN (SELECT "id" FROM "Measurement" WHERE "isCommon");

-- Les éléments spécifiques passent derrière le bloc commun, en gardant leur ordre relatif.
UPDATE "BikeTypeMeasurement" AS l
SET "order" = c.cnt + r.rn - 1
FROM (
    SELECT bl."bikeTypeId", bl."measurementId",
           ROW_NUMBER() OVER (PARTITION BY bl."bikeTypeId" ORDER BY bl."order", m."name" COLLATE "und-x-icu", m."id") AS rn
    FROM "BikeTypeMeasurement" bl
    JOIN "Measurement" m ON m."id" = bl."measurementId"
) AS r,
(SELECT COUNT(*) AS cnt FROM "Measurement" WHERE "isCommon") AS c
WHERE l."bikeTypeId" = r."bikeTypeId" AND l."measurementId" = r."measurementId";

-- Chaque type de vélo reçoit tous les communs, en tête, dans l'ordre par défaut.
INSERT INTO "BikeTypeMeasurement" ("bikeTypeId", "measurementId", "order")
SELECT b."id", m."id",
       ROW_NUMBER() OVER (PARTITION BY b."id" ORDER BY m."commonOrder", m."name" COLLATE "und-x-icu", m."id") - 1
FROM "BikeType" b
CROSS JOIN "Measurement" m
WHERE m."isCommon";

-- ── Mesures du cycliste ───────────────────────────────────────────────────────

DELETE FROM "BikeTypeRiderMeasurement"
WHERE "riderMeasurementId" IN (SELECT "id" FROM "RiderMeasurement" WHERE "isCommon");

UPDATE "BikeTypeRiderMeasurement" AS l
SET "order" = c.cnt + r.rn - 1
FROM (
    SELECT bl."bikeTypeId", bl."riderMeasurementId",
           ROW_NUMBER() OVER (PARTITION BY bl."bikeTypeId" ORDER BY bl."order", m."name" COLLATE "und-x-icu", m."id") AS rn
    FROM "BikeTypeRiderMeasurement" bl
    JOIN "RiderMeasurement" m ON m."id" = bl."riderMeasurementId"
) AS r,
(SELECT COUNT(*) AS cnt FROM "RiderMeasurement" WHERE "isCommon") AS c
WHERE l."bikeTypeId" = r."bikeTypeId" AND l."riderMeasurementId" = r."riderMeasurementId";

INSERT INTO "BikeTypeRiderMeasurement" ("bikeTypeId", "riderMeasurementId", "order")
SELECT b."id", m."id",
       ROW_NUMBER() OVER (PARTITION BY b."id" ORDER BY m."commonOrder", m."name" COLLATE "und-x-icu", m."id") - 1
FROM "BikeType" b
CROSS JOIN "RiderMeasurement" m
WHERE m."isCommon";

-- ── Tests physio ──────────────────────────────────────────────────────────────
-- La liste est plate : le formulaire l'affiche section par section, donc seul
-- compte l'ordre au sein de chaque section — sous-suite de cette liste, inchangée.

DELETE FROM "BikeTypePhysioTest"
WHERE "physioTestId" IN (SELECT "id" FROM "PhysioTest" WHERE "isCommon");

UPDATE "BikeTypePhysioTest" AS l
SET "order" = c.cnt + r.rn - 1
FROM (
    SELECT bl."bikeTypeId", bl."physioTestId",
           ROW_NUMBER() OVER (PARTITION BY bl."bikeTypeId" ORDER BY bl."order", t."name" COLLATE "und-x-icu", t."id") AS rn
    FROM "BikeTypePhysioTest" bl
    JOIN "PhysioTest" t ON t."id" = bl."physioTestId"
) AS r,
(SELECT COUNT(*) AS cnt FROM "PhysioTest" WHERE "isCommon") AS c
WHERE l."bikeTypeId" = r."bikeTypeId" AND l."physioTestId" = r."physioTestId";

INSERT INTO "BikeTypePhysioTest" ("bikeTypeId", "physioTestId", "order")
SELECT b."id", t."id",
       ROW_NUMBER() OVER (PARTITION BY b."id" ORDER BY t."commonOrder", t."name" COLLATE "und-x-icu", t."id") - 1
FROM "BikeType" b
CROSS JOIN "PhysioTest" t
WHERE t."isCommon";
