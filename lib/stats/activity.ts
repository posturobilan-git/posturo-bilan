import "server-only";
import { prisma } from "@/lib/db";

export interface ActivityStats {
  totalPatients: number;
  newPatientsThisMonth: number;
  newPatientsLastMonth: number;
  studiesThisMonth: number;
  studiesLastMonth: number;
  reportsSentThisMonth: number;
  followupResponseRate: number;
}

export async function getActivityStats(): Promise<ActivityStats> {
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

    prisma.study.count({ where: { createdAt: { gte: startOfMonth } } }),

    prisma.study.count({
      where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
    }),

    prisma.study.count({
      where: { reportSentAt: { gte: startOfMonth } },
    }),

    // J+30 response rate = studies that received their follow-up (status
    // followup_completed) over studies that reached the follow-up phase.
    prisma.$queryRaw<[{ rate: number | null }]>`
      SELECT
        ROUND(
          COUNT(*) FILTER (WHERE status = 'followup_completed')::decimal
            / NULLIF(COUNT(*) FILTER (WHERE status IN ('report_sent', 'followup_pending', 'followup_completed')), 0)
            * 100, 1
        )::float as rate
      FROM "Study"
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
