import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentKine } from "@/lib/auth";
import {
  getBikeTypeConfig,
  setBikeTypeMeasurements,
  setBikeTypePhysioTests,
  setCommonMeasurementOrder,
  setCommonPhysioTestOrder,
} from "@/actions/bikeType.actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { BikeTypeConfigurator } from "@/components/bibliotheque/BikeTypeConfigurator";

export default async function BikeTypeConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");
  if (kine.role !== "ADMIN") redirect("/dashboard");

  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const config = await getBikeTypeConfig(id);
  if (!config) redirect("/dashboard/configuration");

  // Bind the bike type id so each configurator just persists an ordered id list.
  const saveMeasurements = setBikeTypeMeasurements.bind(null, id);
  const savePhysioTests = setBikeTypePhysioTests.bind(null, id);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/configuration"
        className="inline-flex items-center gap-1 text-sm font-medium text-content-muted transition-colors hover:text-content"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Configuration des études
      </Link>

      <PageHeader
        title={`Configuration — ${config.bikeType.name}`}
        description="Choisissez les côtes et tests physio relevés pour ce type de vélo, et leur ordre d'affichage dans le formulaire d'étude."
      />

      <Tabs
        defaultTab={tab}
        paramName="tab"
        tabs={[
          {
            id: "cotes",
            label: "Côtes",
            count: config.measurements.common.length + config.measurements.assigned.length,
            content: (
              <BikeTypeConfigurator
                title="Côtes"
                subtitle="Mesures relevées pendant l'étude (avant / après)."
                common={config.measurements.common}
                initialAssigned={config.measurements.assigned}
                initialAvailable={config.measurements.available}
                save={saveMeasurements}
                saveCommon={setCommonMeasurementOrder}
                canEdit
              />
            ),
          },
          {
            id: "tests",
            label: "Tests physio",
            count: config.physioTests.common.length + config.physioTests.assigned.length,
            content: (
              <BikeTypeConfigurator
                title="Tests physiologiques"
                subtitle="Tests réalisés pendant l'étude, selon le type de résultat (valeur, oui/non, commentaire)."
                common={config.physioTests.common}
                initialAssigned={config.physioTests.assigned}
                initialAvailable={config.physioTests.available}
                save={savePhysioTests}
                saveCommon={setCommonPhysioTestOrder}
                canEdit
              />
            ),
          },
        ]}
      />
    </div>
  );
}
