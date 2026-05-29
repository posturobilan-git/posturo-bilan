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

    prisma.postureStudy.count({ where: { createdAt: { gte: startOfMonth } } }),

    prisma.postureStudy.count({
      where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
    }),

    prisma.postureStudy.count({
      where: { reportSentAt: { gte: startOfMonth } },
    }),

    // J+30 response rate = followups received / eligible patients.
    prisma.$queryRaw<[{ rate: number | null }]>`
      SELECT
        ROUND(
          COUNT(f.id)::decimal / NULLIF(COUNT(DISTINCT p.id), 0) * 100, 1
        )::float as rate
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
