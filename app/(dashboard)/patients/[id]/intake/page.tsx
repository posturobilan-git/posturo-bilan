import { redirect } from "next/navigation";
import { getCurrentKine } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { IntakeForm } from "@/components/patients/IntakeForm";

export default async function IntakePage(props: PageProps<"/patients/[id]/intake">) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const { id } = await props.params;

  const patient = await prisma.patient.findUnique({
    where: {
      id,
      ...(kine.role !== "ADMIN" && { kineId: kine.id }),
    },
    include: { intake: true },
  });

  if (!patient) redirect("/patients");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Saisie de l'intake"
        description={`${patient.firstName} ${patient.lastName} — ${patient.email}`}
      />
      <IntakeForm patientId={patient.id} intake={patient.intake} />
    </div>
  );
}
