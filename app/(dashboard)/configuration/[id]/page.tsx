import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentKine } from "@/lib/auth";
import { getBikeTypeConfig } from "@/actions/bikeType.actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { BikeTypeConfigurator } from "@/components/bibliotheque/BikeTypeConfigurator";

export default async function BikeTypeConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");
  if (kine.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const config = await getBikeTypeConfig(id);
  if (!config) redirect("/configuration");

  return (
    <div className="space-y-6">
      <Link
        href="/configuration"
        className="inline-flex items-center gap-1 text-sm font-medium text-content-muted transition-colors hover:text-content"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Configuration des études
      </Link>

      <PageHeader
        title={`Configuration — ${config.bikeType.name}`}
        description="Choisissez les côtes relevées pour ce type de vélo et leur ordre d'affichage dans le formulaire d'étude."
      />

      <BikeTypeConfigurator
        bikeTypeId={config.bikeType.id}
        common={config.common}
        initialAssigned={config.assigned}
        initialAvailable={config.available}
        canEdit={kine.role === "ADMIN"}
      />
    </div>
  );
}
