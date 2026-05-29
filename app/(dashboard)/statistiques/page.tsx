import { redirect } from "next/navigation";
import { getCurrentKine } from "@/lib/auth";
import {
  getActivityStats,
  getMonthlyTrends,
  getClinicalStats,
  getComponentStats,
} from "@/lib/stats";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/statistiques/StatCard";
import { ImpactCard } from "@/components/statistiques/ImpactCard";
import { MonthlyChart } from "@/components/statistiques/MonthlyChart";
import { InjuryChart } from "@/components/statistiques/InjuryChart";
import { CategoryPieChart } from "@/components/statistiques/CategoryPieChart";
import { ComponentsTable } from "@/components/statistiques/ComponentsTable";
import { TopExercisesTable } from "@/components/statistiques/TopExercisesTable";

function delta(current: number, previous: number): { deltaText: string; deltaDir: "up" | "down" | "neutral" } {
  if (previous === 0) {
    return current > 0
      ? { deltaText: `+${current} vs mois dernier`, deltaDir: "up" }
      : { deltaText: "stable vs mois dernier", deltaDir: "neutral" };
  }
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  if (diff === 0) return { deltaText: "stable vs mois dernier", deltaDir: "neutral" };
  return {
    deltaText: `${diff > 0 ? "+" : ""}${pct}% vs mois dernier`,
    deltaDir: diff > 0 ? "up" : "down",
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-content">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-content-subtle">
      {message}
    </div>
  );
}

export default async function StatistiquesPage() {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");
  if (kine.role !== "ADMIN") redirect("/dashboard");

  const [activity, trends, clinical, components] = await Promise.all([
    getActivityStats(),
    getMonthlyTrends(),
    getClinicalStats(),
    getComponentStats(),
  ]);

  const patientsDelta = delta(activity.newPatientsThisMonth, activity.newPatientsLastMonth);
  const studiesDelta = delta(activity.studiesThisMonth, activity.studiesLastMonth);
  const hasTrendData = trends.some((t) => t.studies > 0 || t.patients > 0);

  return (
    <div className="space-y-10">
      <PageHeader title="Statistiques" description="Pilotage de l'activité et impact clinique" />

      {/* Section 1 — Activité */}
      <Section title="Activité du mois">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Patients totaux"
            value={activity.totalPatients}
            deltaText={patientsDelta.deltaText}
            deltaDir={patientsDelta.deltaDir}
          />
          <StatCard
            label="Études ce mois"
            value={activity.studiesThisMonth}
            deltaText={studiesDelta.deltaText}
            deltaDir={studiesDelta.deltaDir}
          />
          <StatCard label="Rapports envoyés ce mois" value={activity.reportsSentThisMonth} />
          <StatCard label="Taux de réponse J+30" value={`${activity.followupResponseRate}%`} />
        </div>
      </Section>

      {/* Section 2 — Évolution mensuelle */}
      <Section title="Évolution sur 12 mois">
        <Card>
          {hasTrendData ? (
            <MonthlyChart data={trends} />
          ) : (
            <EmptyState message="Pas encore assez d'études pour afficher une tendance." />
          )}
        </Card>
      </Section>

      {/* Section 3 — Impact clinique */}
      <Section title="Impact clinique">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ImpactCard
            avgPainLevel={clinical.avgPainLevel}
            avgComfortScore={clinical.avgComfortScore}
            avgSatisfactionScore={clinical.avgSatisfactionScore}
            followupCount={clinical.followupCount}
          />
          <Card>
            <h3 className="mb-4 text-base font-semibold text-content">Douleurs les plus fréquentes</h3>
            {clinical.injuryDistribution.length > 0 ? (
              <InjuryChart data={clinical.injuryDistribution} />
            ) : (
              <EmptyState message="Aucune douleur déclarée à l'intake." />
            )}
          </Card>
        </div>
        <Card>
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold text-content">Hauteur de selle moyenne</h3>
            <span className="text-xs text-content-subtle">sur {clinical.studiesWithSaddle} étude{clinical.studiesWithSaddle !== 1 ? "s" : ""}</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-content">
            {clinical.avgSaddleHeight !== null ? `${clinical.avgSaddleHeight} cm` : "—"}
          </p>
        </Card>
      </Section>

      {/* Section 4 — Composants & stock */}
      <Section title="Composants & stock">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2" padding="none">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold text-content">Top 10 composants</h3>
            </div>
            <div className="overflow-x-auto p-2">
              <ComponentsTable items={components.topComponents} />
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-base font-semibold text-content">Répartition par catégorie</h3>
            {components.byCategory.length > 0 ? (
              <CategoryPieChart data={components.byCategory} />
            ) : (
              <EmptyState message="Aucun composant en bibliothèque." />
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <h3 className="mb-3 text-base font-semibold text-content">Top 5 ce mois</h3>
            {components.topThisMonth.length > 0 ? (
              <ul className="space-y-2">
                {components.topThisMonth.map((c, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-content">
                      {c.name}
                      {c.brand && <span className="text-content-subtle"> · {c.brand}</span>}
                    </span>
                    <span className="font-semibold text-content">{c.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="Aucun composant utilisé ce mois-ci." />
            )}
          </Card>

          <Card padding="none">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold text-content">Top exercices prescrits</h3>
            </div>
            <div className="overflow-x-auto p-2">
              <TopExercisesTable items={components.topExercises} />
            </div>
          </Card>
        </div>
      </Section>
    </div>
  );
}
