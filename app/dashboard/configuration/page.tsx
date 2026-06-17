import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentKine } from "@/lib/auth";
import { getBikeTypes, getActiveBikeTypes } from "@/actions/bikeType.actions";
import { getMeasurements } from "@/actions/measurement.actions";
import { getPhysioTests } from "@/actions/physioTest.actions";
import { getPhysioTestSections } from "@/actions/physioTestSection.actions";
import { SectionsManagerModal } from "@/components/bibliotheque/SectionsManagerModal";
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
  const [bikeTypes, measurements, physioTests, activeBikeTypes, sections] = await Promise.all([
    getBikeTypes(),
    getMeasurements({ search: q }),
    getPhysioTests({ search: q }),
    getActiveBikeTypes(),
    getPhysioTestSections(),
  ]);
  const bikeTypeOptions = activeBikeTypes.map((b) => ({ id: b.id, name: b.name }));
  const sectionOptions = sections.map((s) => ({ id: s.id, name: s.name }));
  const sectionRows = sections.map((s) => ({ id: s.id, name: s.name, testCount: s._count.physioTests }));

  // Group physio tests by section for the library view; tests without a section
  // fall into a trailing « Autres » group. Sections keep their configured order.
  const SANS_SECTION = "__none__";
  const physioGroups = [
    ...sections.map((s) => ({ id: s.id, name: s.name })),
    { id: SANS_SECTION, name: "Autres" },
  ]
    .map((g) => ({
      ...g,
      tests: physioTests.filter((t) => (t.section?.id ?? SANS_SECTION) === g.id),
    }))
    .filter((g) => g.tests.length > 0);

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
                    Tous les tests disponibles, regroupés par section et selon le type de résultat
                    (valeur, oui/non, positif/négatif, commentaire).
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <SectionsManagerModal sections={sectionRows} />
                    <CreatePhysioTestModal bikeTypes={bikeTypeOptions} sections={sectionOptions} />
                  </div>
                </div>
                <Suspense>
                  <SearchBar defaultValue={q} placeholder="Rechercher un test…" />
                </Suspense>
                {physioTests.length === 0 ? (
                  <EmptyState label={q ? "Aucun test ne correspond." : "Aucun test physio pour le moment."} raw />
                ) : (
                  <div className="space-y-6">
                    {physioGroups.map((group) => (
                      <div key={group.id} className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-content-subtle">
                          {group.name}
                        </h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {group.tests.map((t) => (
                            <PhysioTestCard
                              key={t.id}
                              physioTest={t}
                              bikeTypes={bikeTypeOptions}
                              sections={sectionOptions}
                              isAdmin
                            />
                          ))}
                        </div>
                      </div>
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
