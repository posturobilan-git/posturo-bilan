"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useStudyStore, measureValuesToArray } from "@/lib/stores/studyStore";
import { toast } from "@/lib/stores/toastStore";
import { saveDraftStudy, submitStudy } from "@/actions/study.actions";
import { StudyStepper } from "./StudyStepper";
import { BikeTypeStep } from "./BikeTypeStep";
import { MeasuresForm, type MeasurementForStudy } from "./MeasuresForm";
import { ComponentPicker } from "./ComponentPicker";
import { ExercisePicker } from "./ExercisePicker";
import type { BikeComponent, BikeType, Exercise, Patient, PatientIntake } from "@prisma/client";

interface Props {
  patient: Patient & { intake: PatientIntake | null };
  bikeTypes: BikeType[];
  measurements: MeasurementForStudy[];
  components: BikeComponent[];
  exercises: Exercise[];
  /** Pre-filled from an existing study, if any */
  initial?: {
    studyId: string;
    bikeTypeId: string;
    measureValues: Record<string, { before: number | null; after: number | null }>;
    observations: string;
    componentIds: string[];
    exerciseIds: string[];
  };
}

export function StudyForm({ patient, bikeTypes, measurements, components, exercises, initial }: Props) {
  const router = useRouter();
  const store = useStudyStore();
  const [saving, startSave] = useTransition();
  const [submitting, startSubmit] = useTransition();

  // Initialize store once per study target (handles navigation between studies/patients).
  useEffect(() => {
    store.init(patient.id, {
      draftStudyId: initial?.studyId ?? null,
      bikeTypeId: initial?.bikeTypeId ?? null,
      measureValues: initial?.measureValues ?? {},
      observations: initial?.observations ?? "",
      selectedComponentIds: initial?.componentIds ?? [],
      selectedExerciseIds: initial?.exerciseIds ?? [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id, initial?.studyId]);

  // ── Persistence helper ──────────────────────────────────────────────────────

  /** Saves the current store state as a draft. Returns true on success. */
  async function persistDraft(): Promise<boolean> {
    const result = await saveDraftStudy({
      patientId: patient.id,
      draftStudyId: store.draftStudyId ?? undefined,
      bikeTypeId: store.bikeTypeId ?? "",
      measureValues: measureValuesToArray(store.measureValues),
      observations: store.observations || undefined,
      componentIds: store.selectedComponentIds,
      exerciseIds: store.selectedExerciseIds,
    });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    store.setDraftStudyId(result.data.studyId);
    return true;
  }

  // ── Step transitions ──────────────────────────────────────────────────────────

  function handleAdvanceFromStep1() {
    startSave(async () => {
      if (await persistDraft()) store.setStep(2);
    });
  }

  function handleSaveDraft() {
    startSave(async () => {
      if (await persistDraft()) toast.success("Brouillon enregistré.");
    });
  }

  function handleAdvanceFromStep2() {
    startSave(async () => {
      if (await persistDraft()) store.setStep(3);
    });
  }

  function handleAdvanceFromStep3() {
    startSave(async () => {
      if (await persistDraft()) store.setStep(4);
    });
  }

  function handleSubmit() {
    startSubmit(async () => {
      const result = await submitStudy({
        patientId: patient.id,
        draftStudyId: store.draftStudyId ?? undefined,
        bikeTypeId: store.bikeTypeId ?? "",
        measureValues: measureValuesToArray(store.measureValues),
        observations: store.observations || undefined,
        componentIds: store.selectedComponentIds,
        exerciseIds: store.selectedExerciseIds,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Étude soumise avec succès.");
      router.push(`/patients/${patient.id}`);
    });
  }

  return (
    <div className="space-y-6">
      <StudyStepper current={store.step} />

      {store.step === 1 && (
        <BikeTypeStep
          bikeTypes={bikeTypes}
          selected={store.bikeTypeId}
          onSelect={store.setBikeTypeId}
          onNext={handleAdvanceFromStep1}
          saving={saving}
        />
      )}

      {store.step === 2 && (
        <MeasuresForm
          measurements={measurements}
          bikeTypeId={store.bikeTypeId}
          values={store.measureValues}
          observations={store.observations}
          onSetValue={store.setMeasureValue}
          onSetObservations={store.setObservations}
          onBack={() => store.setStep(1)}
          onNext={handleAdvanceFromStep2}
          onSaveDraft={handleSaveDraft}
          saving={saving}
        />
      )}

      {store.step === 3 && (
        <ComponentPicker
          components={components}
          selected={store.selectedComponentIds}
          onToggle={store.toggleComponent}
          onBack={() => store.setStep(2)}
          onNext={handleAdvanceFromStep3}
        />
      )}

      {store.step === 4 && (
        <ExercisePicker
          exercises={exercises}
          components={components}
          selected={store.selectedExerciseIds}
          selectedComponentIds={store.selectedComponentIds}
          measureCount={measureValuesToArray(store.measureValues).length}
          onToggle={store.toggleExercise}
          onBack={() => store.setStep(3)}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  );
}
