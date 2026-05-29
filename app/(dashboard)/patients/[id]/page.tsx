import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentKine } from "@/lib/auth";
import { getPatientDossier } from "@/actions/patient.actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PatientDossier } from "@/components/patients/PatientDossier";
import { ReportActions } from "@/components/patients/ReportActions";
import { PatientHeaderActions } from "@/components/patients/PatientHeaderActions";
import type { PatientWithRelations } from "@/types";

export default async function PatientPage(props: PageProps<"/patients/[id]">) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const { id } = await props.params;
  const patient = await getPatientDossier(id);
  if (!patient) redirect("/patients");

  // getPatientDossier includes kine, cast to full type
  const patientFull = patient as PatientWithRelations;

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
            <Badge status={patient.status} />
            <ActionButtons patient={patientFull} />
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
      <PatientDossier patient={patientFull} />
    </div>
  );
}

function ActionButtons({ patient }: { patient: PatientWithRelations }) {
  const latestStudy = patient.studies[0];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {latestStudy?.reportUrl && (
        <Link
          href={`/api/reports/${latestStudy.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Télécharger PDF
        </Link>
      )}

      {/* Intake — primary CTA while pending, editable afterwards */}
      {patient.status === "intake_pending" && (
        <Link href={`/patients/${patient.id}/intake`}>
          <Button size="sm">Saisir l&apos;intake</Button>
        </Link>
      )}
      {patient.status !== "intake_pending" && (
        <Link href={`/patients/${patient.id}/intake`}>
          <Button variant="secondary" size="sm">Modifier l&apos;intake</Button>
        </Link>
      )}

      {/* Study */}
      {["study_completed", "report_sent", "followup_pending", "followup_completed"].includes(patient.status) && (
        <Link href={`/patients/${patient.id}/etude`}>
          <Button variant="secondary" size="sm">Modifier l&apos;étude</Button>
        </Link>
      )}
      {["intake_completed", "study_pending"].includes(patient.status) && (
        <Link href={`/patients/${patient.id}/etude`}>
          <Button size="sm">Démarrer l&apos;étude</Button>
        </Link>
      )}

      {/* Report — generate (download) and send (email) are separate steps */}
      {latestStudy && ["study_completed", "report_sent", "followup_pending", "followup_completed"].includes(patient.status) && (
        <ReportActions
          studyId={latestStudy.id}
          hasReport={Boolean(latestStudy.reportUrl)}
          alreadySent={Boolean(latestStudy.reportSentAt)}
        />
      )}
    </div>
  );
}
