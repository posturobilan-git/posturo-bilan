import { redirect } from "next/navigation";
import { getCurrentKine } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { IntakeForm } from "@/components/patients/IntakeForm";
import { decryptFields } from "@/lib/crypto";
import { PATIENT_ENCRYPTED_FIELDS, INTAKE_ENCRYPTED_FIELDS } from "@/lib/crypto.constants";

export default async function IntakePage(props: PageProps<"/dashboard/patients/[id]/intake">) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const { id } = await props.params;

  const raw = await prisma.patient.findUnique({
    where: {
      id,
      ...(kine.role !== "ADMIN" && { kineId: kine.id }),
    },
    include: { intake: true },
  });

  if (!raw) redirect("/dashboard/patients");
  const patient = {
    ...decryptFields(raw, PATIENT_ENCRYPTED_FIELDS),
    intake: raw.intake ? decryptFields(raw.intake, INTAKE_ENCRYPTED_FIELDS) : null,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Saisie de l'accueil"
        description={`${patient.firstName} ${patient.lastName} — ${patient.email}`}
      />
      <IntakeForm patientId={patient.id} intake={patient.intake} />
    </div>
  );
}
