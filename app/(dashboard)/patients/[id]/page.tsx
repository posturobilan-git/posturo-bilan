import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentKine } from "@/lib/auth";
import { getPatientDossier } from "@/actions/patient.actions";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { PatientDossier } from "@/components/patients/PatientDossier";
import { PatientHeaderActions } from "@/components/patients/PatientHeaderActions";
import type { PatientWithRelations, MeasurementInfo } from "@/types";

export default async function PatientPage(props: PageProps<"/patients/[id]">) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const { id } = await props.params;
  const patient = await getPatientDossier(id);
  if (!patient) redirect("/patients");

  // getPatientDossier includes kine, cast to full type
  const patientFull = patient as PatientWithRelations;

  // Resolve measurement metadata so study cards can label their côte values.
  const measurements = await prisma.measurement.findMany({
    select: { id: true, name: true, unit: true, order: true },
  });
  const measurementsById: Record<string, MeasurementInfo> = {};
  for (const m of measurements) {
    measurementsById[m.id] = { name: m.name, unit: m.unit, order: m.order };
  }

  // KINE only sees their own patients (query is scoped), so anything visible
  // here is editable; ADMIN can edit everything.
  const canEdit = kine.role === "ADMIN" || patient.kineId === kine.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${patient.firstName} ${patient.lastName}`}
        description={patient.email}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {/* Intake — primary CTA while empty, editable afterwards */}
            <Link href={`/patients/${patient.id}/intake`}>
              <Button variant={patient.intake ? "secondary" : "primary"} size="sm">
                {patient.intake ? "Modifier l'intake" : "Saisir l'intake"}
              </Button>
            </Link>
            {canEdit && (
              <PatientHeaderActions
                patient={{
                  id: patient.id,
                  firstName: patient.firstName,
                  lastName: patient.lastName,
                  email: patient.email,
                  phone: patient.phone,
                }}
              />
            )}
          </div>
        }
      />
      <PatientDossier patient={patientFull} canEdit={canEdit} measurementsById={measurementsById} />
    </div>
  );
}
