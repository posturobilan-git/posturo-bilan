# Prompt 08 — Statistiques

> Utiliser après le prompt 02 (patients en base). Lis CLAUDE.md avant de commencer.

---

## Contexte

Le kiné admin a besoin de statistiques pour piloter son activité et anticiper ses achats de composants.
Toutes les stats sont **admin uniquement** (`requireAdmin()` sur chaque query).

---

## Page — `app/(dashboard)/statistiques/page.tsx`

Server Component. Récupère toutes les données côté serveur et les passe aux composants client (recharts).

Structure : 4 sections avec un titre clair chacune.

---

## Section 1 — Activité (KPIs du mois)

**4 cartes en haut de page, avec comparaison mois précédent.**

### Queries Prisma

```typescript
// lib/stats/activity.ts

export async function getActivityStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalPatients,
    newPatientsThisMonth,
    newPatientsLastMonth,
    studiesThisMonth,
    studiesLastMonth,
    reportsSentThisMonth,
    followupResponseRate,
  ] = await Promise.all([
    prisma.patient.count({ where: { isAnonymized: false } }),

    prisma.patient.count({
      where: { createdAt: { gte: startOfMonth }, isAnonymized: false },
    }),

    prisma.patient.count({
      where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
    }),

    prisma.postureStudy.count({
      where: { createdAt: { gte: startOfMonth } },
    }),

    prisma.postureStudy.count({
      where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
    }),

    prisma.patient.count({
      where: { status: "report_sent", updatedAt: { gte: startOfMonth } },
    }),

    // Taux de réponse J+30 = followups reçus / patients eligibles
    prisma.$queryRaw<[{ rate: number }]>`
      SELECT
        ROUND(
          COUNT(f.id)::decimal / NULLIF(COUNT(p.id), 0) * 100, 1
        ) as rate
      FROM "Patient" p
      LEFT JOIN "Followup" f ON f."patientId" = p.id
      WHERE p.status IN ('followup_pending', 'followup_completed')
    `,
  ]);

  return {
    totalPatients,
    newPatientsThisMonth,
    newPatientsLastMonth,
    studiesThisMonth,
    studiesLastMonth,
    reportsSentThisMonth,
    followupResponseRate: followupResponseRate[0]?.rate ?? 0,
  };
}
```

**UI :** 4 `StatCard` avec valeur principale + delta vs mois précédent (↑ vert / ↓ rouge).

- Patients totaux
- Nouvelles études ce mois
- Rapports envoyés ce mois
- Taux de réponse J+30 (%)

---

## Section 2 — Évolution mensuelle (12 derniers mois)

**Graphique en barres — nouvelles études par mois.**

### Query Prisma

```typescript
// lib/stats/trends.ts

export async function getMonthlyTrends() {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);

  const results = await prisma.$queryRaw<
    { month: string; studies: number; patients: number }[]
  >`
    SELECT
      TO_CHAR(DATE_TRUNC('month', s."createdAt"), 'YYYY-MM') as month,
      COUNT(DISTINCT s.id) as studies,
      COUNT(DISTINCT s."patientId") as patients
    FROM "PostureStudy" s
    WHERE s."createdAt" >= ${twelveMonthsAgo}
    GROUP BY DATE_TRUNC('month', s."createdAt")
    ORDER BY month ASC
  `;

  return results;
}
```

**UI :** `BarChart` recharts avec deux barres (études + nouveaux patients), axe X = mois (format "Jan 25"), tooltip au survol.

---

## Section 3 — Impact clinique

**Les stats les plus importantes — efficacité des études posturales.**

### Query Prisma

```typescript
// lib/stats/clinical.ts

export async function getClinicalStats() {
  // Amélioration moyenne douleur (intake vs followup J+30)
  const painImprovement = await prisma.$queryRaw<
    [{ avg_before: number; avg_after: number; count: number }]
  >`
    SELECT
      AVG(
        (SELECT AVG(value::float)
         FROM jsonb_each_text(i."rawData")
         WHERE key ILIKE '%douleur%' OR key ILIKE '%pain%')
      ) as avg_before,
      AVG(f."painLevel") as avg_after,
      COUNT(f.id) as count
    FROM "Followup" f
    JOIN "Patient" p ON p.id = f."patientId"
    JOIN "PatientIntake" i ON i."patientId" = p.id
    WHERE f."painLevel" IS NOT NULL
  `;

  // Amélioration moyenne confort
  const comfortImprovement = await prisma.$queryRaw<
    [{ avg_score: number; count: number }]
  >`
    SELECT AVG("comfortScore") as avg_score, COUNT(id) as count
    FROM "Followup"
    WHERE "comfortScore" IS NOT NULL
  `;

  // Distribution des douleurs déclarées à l'intake
  const injuryDistribution = await prisma.$queryRaw<
    { injury: string; count: number }[]
  >`
    SELECT
      UNNEST(injuries) as injury,
      COUNT(*) as count
    FROM "PatientIntake"
    GROUP BY injury
    ORDER BY count DESC
    LIMIT 8
  `;

  // Mesure la plus souvent modifiée (selle la plus ajustée)
  const avgSaddleAdjustment = await prisma.$queryRaw<
    [{ avg_height: number; count: number }]
  >`
    SELECT
      AVG((measures->>'saddleHeight')::float) as avg_height,
      COUNT(*) as count
    FROM "PostureStudy"
    WHERE measures->>'saddleHeight' IS NOT NULL
  `;

  return {
    painImprovement: painImprovement[0],
    avgComfortScore: comfortImprovement[0]?.avg_score ?? 0,
    injuryDistribution,
    avgSaddleHeight: avgSaddleAdjustment[0]?.avg_height ?? 0,
  };
}
```

**UI :**

- **Carte "Amélioration douleur"** : jauge avant/après (barre horizontale rouge → verte)
- **Carte "Confort moyen J+30"** : score sur 10 avec étoiles ou jauge
- **Graphique "Douleurs les plus fréquentes"** : `HorizontalBarChart` recharts (top 8)
- **Stat "Hauteur de selle moyenne"** : valeur numérique + note "sur X études"

---

## Section 4 — Composants & stock

**Utile pour anticiper les achats.**

### Query Prisma

```typescript
// lib/stats/components.ts

export async function getComponentStats() {
  // Top composants utilisés (toutes études confondues)
  const topComponents = await prisma.bikeComponent.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { studies: true } },
    },
    orderBy: {
      studies: { _count: "desc" },
    },
    take: 10,
  });

  // Répartition par catégorie
  const byCategory = await prisma.bikeComponent.groupBy({
    by: ["category"],
    _count: { id: true },
    where: { isActive: true },
  });

  // Top composants ce mois-ci
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  );
  const topThisMonth = await prisma.$queryRaw<
    { name: string; brand: string; count: number }[]
  >`
    SELECT bc.name, bc.brand, COUNT(DISTINCT s.id) as count
    FROM "BikeComponent" bc
    JOIN "_StudyComponents" sc ON sc."B" = bc.id
    JOIN "PostureStudy" s ON s.id = sc."A"
    WHERE s."createdAt" >= ${startOfMonth}
    GROUP BY bc.id, bc.name, bc.brand
    ORDER BY count DESC
    LIMIT 5
  `;

  // Top exercices prescrits
  const topExercises = await prisma.exercise.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { studies: true } },
    },
    orderBy: {
      studies: { _count: "desc" },
    },
    take: 8,
  });

  return { topComponents, byCategory, topThisMonth, topExercises };
}
```

**UI :**

- **Table "Top 10 composants"** : rang, nom, marque, catégorie, nb utilisations (avec badge coloré par catégorie)
- **"Top 5 ce mois"** : liste simple avec compteur — utile pour les achats imminents
- **`PieChart` recharts** : répartition par catégorie de composant (Selle, Potence, etc.)
- **Table "Top exercices"** : même format que composants

---

## Composants à créer — `components/statistiques/`

```
StatCard.tsx          — KPI card avec delta mois précédent
MonthlyChart.tsx      — BarChart 12 mois (recharts, Client Component)
InjuryChart.tsx       — HorizontalBarChart douleurs (recharts, Client Component)
ComponentsTable.tsx   — Table top composants avec badges catégorie
CategoryPieChart.tsx  — PieChart catégories (recharts, Client Component)
TopExercisesTable.tsx — Table top exercices
ImpactCard.tsx        — Carte amélioration douleur/confort avec visuel avant/après
```

**Important :** recharts nécessite des Client Components (`"use client"`).
Passer les données depuis la page Server Component via props — ne pas fetcher côté client.

---

## Fichier principal — `lib/stats/index.ts`

```typescript
// Agrège tous les appels stats en un seul export
export { getActivityStats } from "./activity";
export { getMonthlyTrends } from "./trends";
export { getClinicalStats } from "./clinical";
export { getComponentStats } from "./components";
```

Dans `app/(dashboard)/statistiques/page.tsx` :

```typescript
const [activity, trends, clinical, components] = await Promise.all([
  getActivityStats(),
  getMonthlyTrends(),
  getClinicalStats(),
  getComponentStats(),
]);
```

---

## Règles

- Toutes les queries dans `lib/stats/` — jamais directement dans `page.tsx`
- `requireAdmin()` au début de la page avant tout fetch
- Les composants recharts sont tous Client Components — les données leur sont passées en props
- Gérer le cas "pas encore de données" : afficher un état vide explicite plutôt qu'un graphique vide
- Arrondir les moyennes à 1 décimale maximum
- Les `$queryRaw` PostgreSQL sont préférés aux agrégations Prisma complexes pour les stats

---

## Validation

```bash
npx tsc --noEmit
# Naviguer vers /statistiques
# Vérifier que les 4 sections s'affichent
# Vérifier avec Prisma Studio qu'il y a des données de test
# Si DB vide: créer 3-4 études de test via npx prisma studio
```
