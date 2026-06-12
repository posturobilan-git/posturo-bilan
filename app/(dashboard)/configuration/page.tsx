import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentKine } from "@/lib/auth";
import { getBikeTypes, getActiveBikeTypes } from "@/actions/bikeType.actions";
import { getMeasurements } from "@/actions/measurement.actions";
import { getPhysioTests } from "@/actions/physioTest.actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchBar } from "@/components/patients/SearchBar";
import { BikeTypeCard } from "@/components/bibliotheque/BikeTypeCard";
import { MeasurementCard } from "@/components/bibliotheque/MeasurementCard";
import { PhysioTestCard } from "@/components/bibliotheque/PhysioTestCard";
import { CreateBikeTypeModal } from "@/components/bibliotheque/CreateBikeTypeModal";
import { CreateMeasurementModal } from "@/components/bibliotheque/CreateMeasurementModal";
import { CreatePhysioTestModal } from "@/components/bibliotheque/CreatePhysioTestModal";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function ConfigurationPage({ searchParams }: Props) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");
  // Admin-only section.
  if (kine.role !== "ADMIN") redirect("/dashboard");

  const { q } = await searchParams;
  const [bikeTypes, measurements, physioTests, activeBikeTypes] = await Promise.all([
    getBikeTypes(),
    getMeasurements({ search: q }),
    getPhysioTests({ search: q }),
    getActiveBikeTypes(),
  ]);
  const bikeTypeOptions = activeBikeTypes.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Configuration des études"
        description="Types de vélo et côtes relevées pendant les études posturales."
        action={<CreateBikeTypeModal />}
      />

      {/* Bike types — each opens its study configuration */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-content">Types de vélo</h2>
          <p className="text-xs text-content-muted">
            Sélectionnez un type de vélo pour configurer les côtes relevées dans son étude.
          </p>
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

      {/* Shared search across both libraries */}
      <Suspense>
        <SearchBar defaultValue={q} placeholder="Rechercher une côte ou un test…" />
      </Suspense>

      {/* Côtes library — the shared pool of measurements, managed here */}
      <section className="space-y-3 rounded-xl border border-border bg-surface-muted/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-content">Bibliothèque de côtes</h2>
            <p className="text-xs text-content-muted">
              Toutes les côtes disponibles. Affectez-les à un type de vélo depuis sa configuration.
            </p>
          </div>
          <CreateMeasurementModal bikeTypes={bikeTypeOptions} />
        </div>

        {measurements.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 py-10 text-center">
            <p className="text-sm text-gray-500">
              {q ? "Aucune côte ne correspond." : "Aucune côte pour le moment."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {measurements.map((m) => (
              <MeasurementCard key={m.id} measurement={m} bikeTypes={bikeTypeOptions} isAdmin />
            ))}
          </div>
        )}
      </section>

      {/* Physio tests library — same logic as côtes */}
      <section className="space-y-3 rounded-xl border border-border bg-surface-muted/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-content">Bibliothèque de tests physiologiques</h2>
            <p className="text-xs text-content-muted">
              Tous les tests disponibles. Affectez-les à un type de vélo depuis sa configuration.
            </p>
          </div>
          <CreatePhysioTestModal bikeTypes={bikeTypeOptions} />
        </div>

        {physioTests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 py-10 text-center">
            <p className="text-sm text-gray-500">
              {q ? "Aucun test ne correspond." : "Aucun test physio pour le moment."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {physioTests.map((t) => (
              <PhysioTestCard key={t.id} physioTest={t} bikeTypes={bikeTypeOptions} isAdmin />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
      <p className="text-sm text-gray-500">Aucun {label} ne correspond.</p>
    </div>
  );
}
