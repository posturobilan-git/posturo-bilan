import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentKine } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { PatientTable } from "@/components/patients/PatientTable";

async function getStats(kineId: string, isAdmin: boolean) {
  const kineFilter = isAdmin ? {} : { kineId };
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [activePatients, studiesThisMonth, reportsSent, followupsDone] = await Promise.all([
    prisma.patient.count({
      where: {
        ...kineFilter,
        isAnonymized: false,
      },
    }),
    prisma.study.count({
      where: {
        ...(isAdmin ? {} : { kineId }),
        createdAt: { gte: startOfMonth },
      },
    }),
    prisma.study.count({
      where: {
        ...(isAdmin ? {} : { kineId }),
        status: { in: ["report_sent", "followup_pending", "followup_completed"] },
      },
    }),
    prisma.followup.count({
      where: isAdmin ? {} : { patient: { kineId } },
    }),
  ]);

  return { activePatients, studiesThisMonth, reportsSent, followupsDone };
}

const STAT_CARDS = [
  {
    key: "activePatients",
    label: "Patients",
    tint: "bg-brand-50 text-brand-600",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    key: "studiesThisMonth",
    label: "Études ce mois",
    tint: "bg-accent-50 text-accent-600",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    key: "reportsSent",
    label: "Rapports envoyés",
    tint: "bg-success-50 text-success-600",
    icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  },
  {
    key: "followupsDone",
    label: "Suivis réalisés",
    tint: "bg-warning-50 text-warning-600",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  },
] as const;

export default async function DashboardPage() {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const isAdmin = kine.role === "ADMIN";
  const kineFilter = isAdmin ? {} : { kineId: kine.id };

  const [stats, recentPatients] = await Promise.all([
    getStats(kine.id, isAdmin),
    prisma.patient.findMany({
      where: { ...kineFilter, isAnonymized: false },
      include: { kine: { select: { name: true } }, _count: { select: { studies: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title="Tableau de bord" description="Vue d'ensemble de votre activité" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, tint, icon }) => (
          <Card key={key} className="flex items-center gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tint}`}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon} />
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium text-content-muted">{label}</p>
              <p className="mt-0.5 text-3xl font-semibold tracking-tight text-content">{stats[key]}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent patients */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-content">Patients récents</h2>
          <Link
            href="/dashboard/patients"
            className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
          >
            Voir tous →
          </Link>
        </div>
        <PatientTable
          patients={recentPatients}
          emptyMessage="Aucun patient pour le moment. Les patients arrivent via le formulaire d'accueil."
        />
      </div>
    </div>
  );
}
