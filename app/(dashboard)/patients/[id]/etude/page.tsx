import { redirect } from "next/navigation";
import { getCurrentKine } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { PatientSidebar } from "@/components/study/PatientSidebar";
import { StudyForm } from "@/components/study/StudyForm";
import type { StudyMeasures } from "@/types";

export default async function EtudePage(props: PageProps<"/patients/[id]/etude">) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const { id } = await props.params;

  const [patient, components, exercises] = await Promise.all([
    prisma.patient.findUnique({
      where: {
        id,
        ...(kine.role !== "ADMIN" && { kineId: kine.id }),
      },
      include: { intake: true },
    }),
    prisma.bikeComponent.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.exercise.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!patient) redirect("/patients");

  // Pre-fill from most recent study if editing
  const latestStudy = await prisma.postureStudy.findFirst({
    where: { patientId: id },
    include: { componentsUsed: true, exercisesPrescribed: true },
    orderBy: { createdAt: "desc" },
  });

  const initial = latestStudy
    ? {
        studyId: latestStudy.id,
        measures: latestStudy.measures as StudyMeasures,
        componentIds: latestStudy.componentsUsed.map((c) => c.id),
        exerciseIds: latestStudy.exercisesPrescribed.map((e) => e.id),
      }
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Étude posturale"
        description={`${patient.firstName} ${patient.lastName}`}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Patient sidebar — accordion above the form on mobile */}
        <div className="w-full lg:w-64 lg:flex-shrink-0">
          <PatientSidebar patient={patient} />
        </div>

        {/* Multi-step form */}
        <div className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
          <StudyForm
            patient={patient}
            components={components}
            exercises={exercises}
            initial={initial}
          />
        </div>
      </div>
    </div>
  );
}
