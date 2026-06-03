import "server-only";
import { prisma } from "@/lib/db";

export interface MonthlyTrend {
  month: string; // "YYYY-MM"
  studies: number;
  patients: number;
}

export async function getMonthlyTrends(): Promise<MonthlyTrend[]> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<MonthlyTrend[]>`
    SELECT
      TO_CHAR(DATE_TRUNC('month', s."createdAt"), 'YYYY-MM') as month,
      COUNT(DISTINCT s.id)::int as studies,
      COUNT(DISTINCT s."patientId")::int as patients
    FROM "Study" s
    WHERE s."createdAt" >= ${twelveMonthsAgo}
    GROUP BY DATE_TRUNC('month', s."createdAt")
    ORDER BY month ASC
  `;

  // Fill missing months so the chart spans a continuous 12-month axis.
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const filled: MonthlyTrend[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(twelveMonthsAgo);
    d.setMonth(d.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    filled.push(byMonth.get(key) ?? { month: key, studies: 0, patients: 0 });
  }
  return filled;
}
