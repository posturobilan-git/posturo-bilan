import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StudyStatus } from "@prisma/client";
import { getCurrentKine } from "@/lib/auth";
import { getStudies } from "@/actions/study.actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { StudiesTable } from "@/components/patients/StudiesTable";
import { StatusFilter } from "@/components/patients/StatusFilter";

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function EtudesPage({ searchParams }: Props) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const { status } = await searchParams;

  const studies = await getStudies({ status: status as StudyStatus | undefined });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Études"
        description={`${studies.length} étude${studies.length !== 1 ? "s" : ""}`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Suspense>
          <StatusFilter defaultValue={status} />
        </Suspense>
      </div>

      <StudiesTable
        studies={studies}
        emptyMessage={
          status
            ? "Aucune étude ne correspond à ce statut."
            : "Aucune étude pour le moment."
        }
      />
    </div>
  );
}
