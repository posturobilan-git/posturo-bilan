import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentKine } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPatients } from "@/actions/patient.actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { PatientTable } from "@/components/patients/PatientTable";
import { NewPatientButton } from "@/components/patients/NewPatientButton";
import { SearchBar } from "@/components/patients/SearchBar";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function PatientsPage({ searchParams }: Props) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const { q } = await searchParams;

  const patients = await getPatients({ search: q });

  // ADMIN can assign a new patient to any active kiné; KINE only ever creates
  // for themselves so the list is fetched lazily for admins only.
  const kines =
    kine.role === "ADMIN"
      ? await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "KINE"] } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients"
        description={`${patients.length} patient${patients.length !== 1 ? "s" : ""}`}
        action={
          <NewPatientButton
            currentUserRole={kine.role}
            currentUserId={kine.id}
            kines={kines}
          />
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Suspense>
            <SearchBar defaultValue={q} />
          </Suspense>
        </div>
      </div>

      <PatientTable
        patients={patients}
        emptyMessage={
          q
            ? "Aucun patient ne correspond à cette recherche."
            : "Aucun patient pour le moment."
        }
      />
    </div>
  );
}
