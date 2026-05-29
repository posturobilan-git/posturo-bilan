import "server-only";
import { prisma } from "@/lib/db";

export interface ClinicalStats {
  avgPainLevel: number | null; // J+30 residual pain (lower is better)
  avgComfortScore: number | null;
  avgSatisfactionScore: number | null;
  followupCount: number;
  injuryDistribution: { injury: string; count: number }[];
  avgSaddleHeight: number | null;
  studiesWithSaddle: number;
}

export async function getClinicalStats(): Promise<ClinicalStats> {
  const [outcomes, injuries, saddle] = await Promise.all([
    prisma.$queryRaw<[{ avg_pain: number | null; avg_comfort: number | null; avg_satisfaction: number | null; count: number }]>`
      SELECT
        ROUND(AVG("painLevel")::numeric, 1)::float as avg_pain,
        ROUND(AVG("comfortScore")::numeric, 1)::float as avg_comfort,
        ROUND(AVG("satisfactionScore")::numeric, 1)::float as avg_satisfaction,
        COUNT(id)::int as count
      FROM "Followup"
    `,

    prisma.$queryRaw<{ injury: string; count: number }[]>`
      SELECT UNNEST(injuries) as injury, COUNT(*)::int as count
      FROM "PatientIntake"
      GROUP BY injury
      ORDER BY count DESC
      LIMIT 8
    `,

    prisma.$queryRaw<[{ avg_height: number | null; count: number }]>`
      SELECT
        ROUND(AVG((measures->>'saddleHeight')::float)::numeric, 1)::float as avg_height,
        COUNT(*)::int as count
      FROM "PostureStudy"
      WHERE measures->>'saddleHeight' IS NOT NULL
    `,
  ]);

  return {
    avgPainLevel: outcomes[0]?.avg_pain ?? null,
    avgComfortScore: outcomes[0]?.avg_comfort ?? null,
    avgSatisfactionScore: outcomes[0]?.avg_satisfaction ?? null,
    followupCount: outcomes[0]?.count ?? 0,
    injuryDistribution: injuries,
    avgSaddleHeight: saddle[0]?.avg_height ?? null,
    studiesWithSaddle: saddle[0]?.count ?? 0,
  };
}
