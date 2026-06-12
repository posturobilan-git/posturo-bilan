"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  useStudyStore,
  measureValuesToArray,
  physioResultsToArray,
} from "@/lib/stores/studyStore";
import { toast } from "@/lib/stores/toastStore";
import { saveDraftStudy, submitStudy } from "@/actions/study.actions";
import { StudyStepper } from "./StudyStepper";
import { BikeTypeStep } from "./BikeTypeStep";
import { MeasuresForm, type MeasurementForStudy } from "./MeasuresForm";
import { PhysioTestsForm, type PhysioTestForStudy } from "./PhysioTestsForm";
import { ComponentPicker, type ComponentForStudy } from "./ComponentPicker";
import { ExercisePicker } from "./ExercisePicker";
import type { BikeType, Exercise, Patient, PatientIntake } from "@prisma/client";
import type { PhysioValue } from "@/lib/physio";

interface Props {
  patient: Patient & { intake: PatientIntake | null };
  bikeTypes: BikeType[];
  measurements: MeasurementForStudy[];
  physioTests: PhysioTestForStudy[];
  components: ComponentForStudy[];
  exercises: Exercise[];
  /** Pre-filled from an existing study, if any */
  initial?: {
    studyId: string;
    bikeTypeId: string;
    measureValues: Record<string, { before: number | null; after: number | null }>;
    physioResults: Record<string, PhysioValue>;
    observations: string;
    componentIds: string[];
    exerciseIds: string[];
  };
}

export function StudyForm({
  patient,
  bikeTypes,
  measurements,
  physioTests,
  components,
  exercises,
  initial,
}: Props) {
  const router = useRouter();
  const store = useStudyStore();
  const [saving, startSave] = useTransition();
  const [submitting, startSubmit] = useTransition();

  // Initialize store once per study target (handles navigation between studies/patients).
  useEffect(() => {
    // Stored values whose côte isn't configured for this bike type were added
    // on the fly for this study — restore them as extras when editing.
    const configuredIds = new Set(
      measurements
        .filter(
          (m) =>
            m.isCommon ||
            m.bikeTypeLinks.some((b) => b.bikeTypeId === initial?.bikeTypeId)
        )
        .map((m) => m.id)
    );
    const knownIds = new Set(measurements.map((m) => m.id));
    const extraMeasurementIds = Object.keys(initial?.measureValues ?? {}).filter(
      (id) => !configuredIds.has(id) && knownIds.has(id)
    );

    store.init(patient.id, {
      draftStudyId: initial?.studyId ?? null,
      bikeTypeId: initial?.bikeTypeId ?? null,
      measureValues: initial?.measureValues ?? {},
      extraMeasurementIds,
      physioResults: initial?.physioResults ?? {},
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
      physioResults: physioResultsToArray(store.physioResults),
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

  /** Persists the draft, then advances to the given step. */
  function advanceTo(step: 2 | 3 | 4 | 5 | 6) {
    startSave(async () => {
      if (await persistDraft()) store.setStep(step);
    });
  }

  function handleSaveDraft() {
    startSave(async () => {
      if (await persistDraft()) toast.success("Brouillon enregistré.");
    });
  }

  function handleSubmit() {
    startSubmit(async () => {
      const result = await submitStudy({
        patientId: patient.id,
        draftStudyId: store.draftStudyId ?? undefined,
        bikeTypeId: store.bikeTypeId ?? "",
        measureValues: measureValuesToArray(store.measureValues),
        physioResults: physioResultsToArray(store.physioResults),
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

  // Shared props for the two measurement phases (avant / après).
  const measureStepProps = {
    measurements,
    bikeTypeId: store.bikeTypeId,
    values: store.measureValues,
    extraMeasurementIds: store.extraMeasurementIds,
    observations: store.observations,
    onSetValue: store.setMeasureValue,
    onAddExtra: store.addExtraMeasurement,
    onRemoveExtra: store.removeExtraMeasurement,
    onSetObservations: store.setObservations,
    onSaveDraft: handleSaveDraft,
    saving,
  };

  return (
    <div className="space-y-6">
      <StudyStepper current={store.step} />

      {store.step === 1 && (
        <BikeTypeStep
          bikeTypes={bikeTypes}
          selected={store.bikeTypeId}
          onSelect={store.setBikeTypeId}
          onNext={() => advanceTo(2)}
          saving={saving}
        />
      )}

      {store.step === 2 && (
        <PhysioTestsForm
          physioTests={physioTests}
          bikeTypeId={store.bikeTypeId}
          results={store.physioResults}
          onSetValue={store.setPhysioValue}
          onBack={() => store.setStep(1)}
          onNext={() => advanceTo(3)}
          onSaveDraft={handleSaveDraft}
          saving={saving}
        />
      )}

      {store.step === 3 && (
        <MeasuresForm
          {...measureStepProps}
          phase="before"
          onBack={() => store.setStep(2)}
          onNext={() => advanceTo(4)}
        />
      )}

      {store.step === 4 && (
        <MeasuresForm
          {...measureStepProps}
          phase="after"
          onBack={() => store.setStep(3)}
          onNext={() => advanceTo(5)}
        />
      )}

      {store.step === 5 && (
        <ComponentPicker
          components={components}
          bikeTypeId={store.bikeTypeId}
          selected={store.selectedComponentIds}
          onToggle={store.toggleComponent}
          onBack={() => store.setStep(4)}
          onNext={() => advanceTo(6)}
        />
      )}

      {store.step === 6 && (
        <ExercisePicker
          exercises={exercises}
          components={components}
          selected={store.selectedExerciseIds}
          selectedComponentIds={store.selectedComponentIds}
          measureCount={measureValuesToArray(store.measureValues).length}
          onToggle={store.toggleExercise}
          onBack={() => store.setStep(5)}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  );
}
