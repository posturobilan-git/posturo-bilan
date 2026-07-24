import { redirect } from "next/navigation";
import { getCurrentKine } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { PatientSidebar } from "@/components/study/PatientSidebar";
import { StudyForm } from "@/components/study/StudyForm";
import type { StudyMeasureValue, StudyRiderMeasureValue } from "@/types";
import type { PhysioValue, StudyPhysioResult } from "@/lib/physio";
import { decryptFields } from "@/lib/crypto";
import { PATIENT_ENCRYPTED_FIELDS, INTAKE_ENCRYPTED_FIELDS } from "@/lib/crypto.constants";
import { getAttributesByCategory } from "@/actions/componentAttribute.actions";
import { getActiveCategories } from "@/actions/componentCategory.actions";

export default async function EtudePage(props: PageProps<"/dashboard/patients/[id]/etude">) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const { id } = await props.params;
  const { studyId } = await props.searchParams;
  const editStudyId = typeof studyId === "string" ? studyId : undefined;

  const [patientRaw, bikeTypes, measurements, riderMeasurements, physioTests, components, exercises, attributesByCategory, categories] = await Promise.all([
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
    prisma.riderMeasurement.findMany({
      where: { isActive: true },
      include: { bikeTypeLinks: { select: { bikeTypeId: true, order: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.physioTest.findMany({
      where: { isActive: true },
      include: {
        bikeTypeLinks: { select: { bikeTypeId: true, order: true } },
        section: { select: { id: true, name: true, order: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.bikeComponent.findMany({
      where: { isActive: true },
      include: {
        bikeTypes: { select: { id: true } },
        category: { select: { name: true } },
        attributeValues: { select: { attributeId: true, valueText: true, valueNumber: true, valueBoolean: true } },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.exercise.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    getAttributesByCategory(),
    getActiveCategories(),
  ]);

  if (!patientRaw) redirect("/dashboard/patients");
  const patient = {
    ...decryptFields(patientRaw, PATIENT_ENCRYPTED_FIELDS),
    intake: patientRaw.intake ? decryptFields(patientRaw.intake, INTAKE_ENCRYPTED_FIELDS) : null,
  };

  // Editing: load the specific study (scoped). Creating: no initial data.
  const study = editStudyId
    ? await prisma.study.findUnique({
        where: {
          id: editStudyId,
          patientId: id,
          ...(kine.role !== "ADMIN" && { kineId: kine.id }),
        },
        include: {
          componentsUsed: true,
          exercisesPrescribed: true,
          pains: { orderBy: { order: "asc" } },
          photos: { orderBy: [{ phase: "asc" }, { order: "asc" }] },
        },
      })
    : null;

  if (editStudyId && !study) redirect(`/dashboard/patients/${id}`);

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

  // Same conversion for the stored mesures du cycliste.
  const riderMeasureValues: Record<string, { before: number | null; after: number | null }> = {};
  for (const v of (study?.riderMeasureValues as StudyRiderMeasureValue[] | null) ?? []) {
    riderMeasureValues[v.riderMeasurementId] = { before: v.before ?? null, after: v.after ?? null };
  }

  // Same conversion for the stored physio results (one value per test) + comments.
  const physioResults: Record<string, PhysioValue> = {};
  const physioComments: Record<string, string> = {};
  for (const r of (study?.physioResults as StudyPhysioResult[] | null) ?? []) {
    physioResults[r.physioTestId] = r.value ?? null;
    if (r.comment) physioComments[r.physioTestId] = r.comment;
  }

  const initial = study
    ? {
        studyId: study.id,
        bikeTypeId: study.bikeTypeId,
        measureValues,
        riderMeasureValues,
        physioResults,
        physioComments,
        pains: study.pains.map((p) => ({
          location: p.location,
          type: p.type ?? "",
          intensity: p.intensity ?? "",
          restAtRest: p.restAtRest,
          activity: p.activity ?? "",
          duration: p.duration ?? "",
          aggravatingFactors: p.aggravatingFactors ?? "",
          relievingFactors: p.relievingFactors ?? "",
        })),
        // Existing photos are served (privately) via /api/photos/[id] for preview.
        photos: study.photos.map((p) => ({
          url: p.url,
          previewUrl: `/api/photos/${p.id}`,
          phase: p.phase,
          angle: p.angle,
          caption: p.caption ?? "",
        })),
        observations: study.observations ?? "",
        summary: study.summary ?? "",
        recommendations: study.recommendations ?? "",
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
        <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface p-4 sm:p-6">
          <StudyForm
            patient={patient}
            bikeTypes={bikeTypeOptions}
            measurements={measurements}
            riderMeasurements={riderMeasurements}
            physioTests={physioTests}
            components={components}
            categories={categories}
            exercises={exercises}
            attributesByCategory={attributesByCategory}
            initial={initial}
          />
        </div>
      </div>
    </div>
  );
}
