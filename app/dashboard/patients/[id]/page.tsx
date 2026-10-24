import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentKine } from "@/lib/auth";
import { getPatientDossier } from "@/actions/patient.actions";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { PatientDossier } from "@/components/patients/PatientDossier";
import { PatientHeaderActions } from "@/components/patients/PatientHeaderActions";
import { SendIntakeButton } from "@/components/patients/SendIntakeButton";
import type { PatientWithRelations, MeasurementInfo } from "@/types";
import type { PhysioTestInfo } from "@/lib/physio";

export default async function PatientPage(props: PageProps<"/dashboard/patients/[id]">) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const { id } = await props.params;
  const patient = await getPatientDossier(id);
  if (!patient) redirect("/dashboard/patients");

  // getPatientDossier includes kine, cast to full type
  const patientFull = patient as PatientWithRelations;

  // Resolve measurement & physio-test metadata so study cards can label values —
  // and order them like the study form (each bike type's configured order).
  const orderSelect = {
    isCommon: true,
    commonOrder: true,
    bikeTypeLinks: { select: { bikeTypeId: true, order: true } },
  } as const;
  const [measurements, riderMeasurements, physioTests] = await Promise.all([
    prisma.measurement.findMany({ select: { id: true, name: true, unit: true, ...orderSelect } }),
    prisma.riderMeasurement.findMany({ select: { id: true, name: true, unit: true, ...orderSelect } }),
    prisma.physioTest.findMany({
      select: {
        id: true,
        name: true,
        unit: true,
        outputType: true,
        ...orderSelect,
        section: { select: { id: true, name: true, order: true } },
      },
    }),
  ]);
  const measurementsById: Record<string, MeasurementInfo> = {};
  for (const { id, ...info } of measurements) measurementsById[id] = info;
  const riderMeasurementsById: Record<string, MeasurementInfo> = {};
  for (const { id, ...info } of riderMeasurements) riderMeasurementsById[id] = info;
  const physioTestsById: Record<string, PhysioTestInfo> = {};
  for (const { id, ...info } of physioTests) physioTestsById[id] = info;

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
            {/* Accueil pending — let the kiné email the patient the form link */}
            {canEdit && !patient.intake && (
              <SendIntakeButton patientId={patient.id} patientEmail={patient.email} />
            )}
            {/* Saisie manuelle de l'accueil — secondaire si déjà rempli */}
            <Link href={`/dashboard/patients/${patient.id}/intake`} prefetch={false}>
              <Button variant="secondary" size="sm">
                {patient.intake ? "Modifier l'accueil" : "Saisir l'accueil"}
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
                studyCount={patientFull.studies.length}
                isAnonymized={patient.isAnonymized}
              />
            )}
          </div>
        }
      />
      <PatientDossier
        patient={patientFull}
        canEdit={canEdit}
        measurementsById={measurementsById}
        riderMeasurementsById={riderMeasurementsById}
        physioTestsById={physioTestsById}
      />
    </div>
  );
}
