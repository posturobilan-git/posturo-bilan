import "server-only";
import { prisma } from "@/lib/db";
import type { StudyMeasureValue } from "@/types";

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

    // Average final saddle height across studies, computed from the dynamic
    // côtes ("Hauteur de selle") since measures are no longer fixed columns.
    avgSaddleHeight(),
  ]);

  return {
    avgPainLevel: outcomes[0]?.avg_pain ?? null,
    avgComfortScore: outcomes[0]?.avg_comfort ?? null,
    avgSatisfactionScore: outcomes[0]?.avg_satisfaction ?? null,
    followupCount: outcomes[0]?.count ?? 0,
    injuryDistribution: injuries,
    avgSaddleHeight: saddle.avg,
    studiesWithSaddle: saddle.count,
  };
}

/** Average of the "after" saddle-height côte across all studies. */
async function avgSaddleHeight(): Promise<{ avg: number | null; count: number }> {
  const measurement = await prisma.measurement.findFirst({
    where: { name: { contains: "Hauteur de selle", mode: "insensitive" } },
    select: { id: true },
  });
  if (!measurement) return { avg: null, count: 0 };

  const studies = await prisma.study.findMany({ select: { measureValues: true } });
  const heights: number[] = [];
  for (const s of studies) {
    const values = (s.measureValues as StudyMeasureValue[] | null) ?? [];
    const v = values.find((x) => x.measurementId === measurement.id);
    if (v?.after != null) heights.push(v.after);
  }
  if (heights.length === 0) return { avg: null, count: 0 };
  const avg = Math.round((heights.reduce((a, b) => a + b, 0) / heights.length) * 10) / 10;
  return { avg, count: heights.length };
}
