import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentKine } from "@/lib/auth";
import { getBikeTypes, getActiveBikeTypes } from "@/actions/bikeType.actions";
import { getMeasurements } from "@/actions/measurement.actions";
import { getPhysioTests } from "@/actions/physioTest.actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { SearchBar } from "@/components/patients/SearchBar";
import { BikeTypeCard } from "@/components/bibliotheque/BikeTypeCard";
import { MeasurementCard } from "@/components/bibliotheque/MeasurementCard";
import { PhysioTestCard } from "@/components/bibliotheque/PhysioTestCard";
import { CreateBikeTypeModal } from "@/components/bibliotheque/CreateBikeTypeModal";
import { CreateMeasurementModal } from "@/components/bibliotheque/CreateMeasurementModal";
import { CreatePhysioTestModal } from "@/components/bibliotheque/CreatePhysioTestModal";

interface Props {
  searchParams: Promise<{ q?: string; tab?: string }>;
}

export default async function ConfigurationPage({ searchParams }: Props) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");
  // Admin-only section.
  if (kine.role !== "ADMIN") redirect("/dashboard");

  const { q, tab } = await searchParams;
  const [bikeTypes, measurements, physioTests, activeBikeTypes] = await Promise.all([
    getBikeTypes(),
    getMeasurements({ search: q }),
    getPhysioTests({ search: q }),
    getActiveBikeTypes(),
  ]);
  const bikeTypeOptions = activeBikeTypes.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration des études"
        description="Types de vélo, côtes et tests physio relevés pendant les études posturales."
      />

      <Tabs
        defaultTab={tab}
        paramName="tab"
        tabs={[
          {
            id: "velos",
            label: "Types de vélo",
            count: bikeTypes.length,
            content: (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-content-muted">
                    Sélectionnez un type de vélo pour configurer les côtes et tests relevés dans son étude.
                  </p>
                  <CreateBikeTypeModal />
                </div>
                {bikeTypes.length === 0 ? (
                  <EmptyState label="type de vélo" />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {bikeTypes.map((bt) => (
                      <BikeTypeCard key={bt.id} bikeType={bt} isAdmin />
                    ))}
                  </div>
                )}
              </section>
            ),
          },
          {
            id: "cotes",
            label: "Côtes",
            count: measurements.length,
            content: (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-content-muted">
                    Toutes les côtes disponibles. Affectez-les à un type de vélo depuis sa configuration.
                  </p>
                  <CreateMeasurementModal bikeTypes={bikeTypeOptions} />
                </div>
                <Suspense>
                  <SearchBar defaultValue={q} placeholder="Rechercher une côte…" />
                </Suspense>
                {measurements.length === 0 ? (
                  <EmptyState label={q ? "Aucune côte ne correspond." : "Aucune côte pour le moment."} raw />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {measurements.map((m) => (
                      <MeasurementCard key={m.id} measurement={m} bikeTypes={bikeTypeOptions} isAdmin />
                    ))}
                  </div>
                )}
              </section>
            ),
          },
          {
            id: "tests",
            label: "Tests physio",
            count: physioTests.length,
            content: (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-content-muted">
                    Tous les tests disponibles, selon le type de résultat (valeur, oui/non, commentaire).
                  </p>
                  <CreatePhysioTestModal bikeTypes={bikeTypeOptions} />
                </div>
                <Suspense>
                  <SearchBar defaultValue={q} placeholder="Rechercher un test…" />
                </Suspense>
                {physioTests.length === 0 ? (
                  <EmptyState label={q ? "Aucun test ne correspond." : "Aucun test physio pour le moment."} raw />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {physioTests.map((t) => (
                      <PhysioTestCard key={t.id} physioTest={t} bikeTypes={bikeTypeOptions} isAdmin />
                    ))}
                  </div>
                )}
              </section>
            ),
          },
        ]}
      />
    </div>
  );
}

function EmptyState({ label, raw = false }: { label: string; raw?: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong py-12 text-center">
      <p className="text-sm text-content-muted">{raw ? label : `Aucun ${label} ne correspond.`}</p>
    </div>
  );
}
