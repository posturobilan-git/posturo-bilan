import { redirect } from "next/navigation";
import { getCurrentKine } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { PatientSidebar } from "@/components/study/PatientSidebar";
import { StudyForm } from "@/components/study/StudyForm";
import type { StudyMeasureValue } from "@/types";

export default async function EtudePage(props: PageProps<"/patients/[id]/etude">) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const { id } = await props.params;
  const { studyId } = await props.searchParams;
  const editStudyId = typeof studyId === "string" ? studyId : undefined;

  const [patient, bikeTypes, measurements, components, exercises] = await Promise.all([
    prisma.patient.findUnique({
      where: {
        id,
        ...(kine.role !== "ADMIN" && { kineId: kine.id }),
      },
      include: { intake: true },
    }),
    prisma.bikeType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.measurement.findMany({
      where: { isActive: true },
      include: { bikeTypeLinks: { select: { bikeTypeId: true, order: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.bikeComponent.findMany({
      where: { isActive: true },
      include: { bikeTypes: { select: { id: true } } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.exercise.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!patient) redirect("/patients");

  // Editing: load the specific study (scoped). Creating: no initial data.
  const study = editStudyId
    ? await prisma.study.findUnique({
        where: {
          id: editStudyId,
          patientId: id,
          ...(kine.role !== "ADMIN" && { kineId: kine.id }),
        },
        include: { componentsUsed: true, exercisesPrescribed: true },
      })
    : null;

  if (editStudyId && !study) redirect(`/patients/${id}`);

  // Editing gently: if the study's bike type has since been deactivated, it's
  // missing from the active list above — re-include it so it stays selectable
  // and the original choice isn't silently lost.
  const bikeTypeOptions = [...bikeTypes];
  if (study && !bikeTypeOptions.some((b) => b.id === study.bikeTypeId)) {
    const current = await prisma.bikeType.findUnique({ where: { id: study.bikeTypeId } });
    if (current) bikeTypeOptions.push(current);
  }

  // Convert the stored measure-values array into the keyed map the form uses.
  const measureValues: Record<string, { before: number | null; after: number | null }> = {};
  for (const v of (study?.measureValues as StudyMeasureValue[] | null) ?? []) {
    measureValues[v.measurementId] = { before: v.before ?? null, after: v.after ?? null };
  }

  const initial = study
    ? {
        studyId: study.id,
        bikeTypeId: study.bikeTypeId,
        measureValues,
        observations: study.observations ?? "",
        componentIds: study.componentsUsed.map((c) => c.id),
        exerciseIds: study.exercisesPrescribed.map((e) => e.id),
      }
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={study ? "Modifier l'étude" : "Nouvelle étude"}
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
            bikeTypes={bikeTypeOptions}
            measurements={measurements}
            components={components}
            exercises={exercises}
            initial={initial}
          />
        </div>
      </div>
    </div>
  );
}
