"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  useStudyStore,
  measureValuesToArray,
  riderMeasureValuesToArray,
  physioResultsToArray,
  type StudyStep,
} from "@/lib/stores/studyStore";
import { toast } from "@/lib/stores/toastStore";
import { saveDraftStudy, submitStudy } from "@/actions/study.actions";
import { StudyStepper } from "./StudyStepper";
import { BikeTypeStep } from "./BikeTypeStep";
import { MeasuresForm, type MeasurementForStudy } from "./MeasuresForm";
import { RiderMeasuresForm, type RiderMeasurementForStudy } from "./RiderMeasuresForm";
import { PhysioTestsForm, type PhysioTestForStudy } from "./PhysioTestsForm";
import { ComponentPicker, type ComponentForStudy } from "./ComponentPicker";
import { ExercisePicker } from "./ExercisePicker";
import type { BikeType, Exercise, Patient, PatientIntake } from "@prisma/client";
import type { PhysioValue } from "@/lib/physio";

interface Props {
  patient: Patient & { intake: PatientIntake | null };
  bikeTypes: BikeType[];
  measurements: MeasurementForStudy[];
  riderMeasurements: RiderMeasurementForStudy[];
  physioTests: PhysioTestForStudy[];
  components: ComponentForStudy[];
  exercises: Exercise[];
  /** Pre-filled from an existing study, if any */
  initial?: {
    studyId: string;
    bikeTypeId: string;
    measureValues: Record<string, { before: number | null; after: number | null }>;
    riderMeasureValues: Record<string, { before: number | null; after: number | null }>;
    physioResults: Record<string, PhysioValue>;
    physioComments: Record<string, string>;
    observations: string;
    componentIds: string[];
    exerciseIds: string[];
  };
}

export function StudyForm({
  patient,
  bikeTypes,
  measurements,
  riderMeasurements,
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

    // Same restore logic for the mesures du cycliste added on the fly.
    const configuredRiderIds = new Set(
      riderMeasurements
        .filter(
          (m) =>
            m.isCommon ||
            m.bikeTypeLinks.some((b) => b.bikeTypeId === initial?.bikeTypeId)
        )
        .map((m) => m.id)
    );
    const knownRiderIds = new Set(riderMeasurements.map((m) => m.id));
    const extraRiderMeasurementIds = Object.keys(initial?.riderMeasureValues ?? {}).filter(
      (id) => !configuredRiderIds.has(id) && knownRiderIds.has(id)
    );

    store.init(patient.id, {
      draftStudyId: initial?.studyId ?? null,
      bikeTypeId: initial?.bikeTypeId ?? null,
      measureValues: initial?.measureValues ?? {},
      extraMeasurementIds,
      riderMeasureValues: initial?.riderMeasureValues ?? {},
      extraRiderMeasurementIds,
      physioResults: initial?.physioResults ?? {},
      physioComments: initial?.physioComments ?? {},
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
      riderMeasureValues: riderMeasureValuesToArray(store.riderMeasureValues),
      physioResults: physioResultsToArray(store.physioResults, store.physioComments),
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

  // ── Required-field guards ─────────────────────────────────────────────────────

  /** Required physio tests applicable to the bike type that have no result yet. */
  function missingRequiredTests(): string[] {
    const btId = store.bikeTypeId;
    const missing: string[] = [];
    for (const t of physioTests) {
      if (!t.isRequired) continue;
      const applies = t.isCommon || t.bikeTypeLinks.some((b) => b.bikeTypeId === btId);
      if (!applies) continue;
      const v = store.physioResults[t.id];
      if (v === null || v === undefined || v === "") missing.push(t.name);
    }
    return missing;
  }

  /** Required côtes applicable to the bike type with no "before" value yet. */
  function missingRequiredMeasures(): string[] {
    const btId = store.bikeTypeId;
    const missing: string[] = [];
    for (const m of measurements) {
      if (!m.isRequired) continue;
      const applies = m.isCommon || m.bikeTypeLinks.some((b) => b.bikeTypeId === btId);
      if (!applies) continue;
      if (store.measureValues[m.id]?.before == null) missing.push(m.name);
    }
    return missing;
  }

  /** Required mesures du cycliste applicable to the bike type with no "before" yet. */
  function missingRequiredRiderMeasures(): string[] {
    const btId = store.bikeTypeId;
    const missing: string[] = [];
    for (const m of riderMeasurements) {
      if (!m.isRequired) continue;
      const applies = m.isCommon || m.bikeTypeLinks.some((b) => b.bikeTypeId === btId);
      if (!applies) continue;
      if (store.riderMeasureValues[m.id]?.before == null) missing.push(m.name);
    }
    return missing;
  }

  /** Missing required fields owned by the given step (the one being left). */
  function missingForStep(step: number): string[] {
    if (step === 2) return missingRequiredTests(); // Tests physio
    if (step === 3) return missingRequiredMeasures(); // Mesures vélo (avant)
    if (step === 4) return missingRequiredRiderMeasures(); // Mesures cycliste
    return [];
  }

  // ── Step transitions ──────────────────────────────────────────────────────────

  /**
   * Persists the draft, then advances to the given step. Blocks the move when a
   * required côte/test on the current step is still empty (drafts may stay
   * partial, but you can't step past an unfilled required field).
   */
  function advanceTo(step: 2 | 3 | 4 | 5 | 6 | 7) {
    const missing = missingForStep(store.step);
    if (missing.length > 0) {
      toast.error(`Champs obligatoires manquants : ${missing.join(", ")}.`);
      return;
    }
    startSave(async () => {
      if (await persistDraft()) store.setStep(step);
    });
  }

  /**
   * Jumps to an arbitrary step via the stepper. Going back is always allowed and
   * instant. Going forward persists the draft first and refuses to skip over a
   * step whose required côtes/tests are still empty (same guard as Next).
   */
  function goToStep(target: StudyStep) {
    if (target === store.step) return;
    if (target < store.step) {
      store.setStep(target);
      return;
    }
    for (let s = store.step; s < target; s++) {
      const missing = missingForStep(s);
      if (missing.length > 0) {
        toast.error(`Champs obligatoires manquants : ${missing.join(", ")}.`);
        return;
      }
    }
    startSave(async () => {
      if (await persistDraft()) store.setStep(target);
    });
  }

  function handleSaveDraft() {
    startSave(async () => {
      if (await persistDraft()) toast.success("Brouillon enregistré.");
    });
  }

  function handleSubmit() {
    // Final safety net — covers every required field regardless of step.
    const missing = [
      ...missingRequiredTests(),
      ...missingRequiredMeasures(),
      ...missingRequiredRiderMeasures(),
    ];
    if (missing.length > 0) {
      toast.error(`Champs obligatoires manquants : ${missing.join(", ")}.`);
      return;
    }
    startSubmit(async () => {
      const result = await submitStudy({
        patientId: patient.id,
        draftStudyId: store.draftStudyId ?? undefined,
        bikeTypeId: store.bikeTypeId ?? "",
        measureValues: measureValuesToArray(store.measureValues),
        riderMeasureValues: riderMeasureValuesToArray(store.riderMeasureValues),
        physioResults: physioResultsToArray(store.physioResults, store.physioComments),
        observations: store.observations || undefined,
        componentIds: store.selectedComponentIds,
        exerciseIds: store.selectedExerciseIds,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Étude soumise avec succès.");
      router.push(`/dashboard/patients/${patient.id}`);
    });
  }

  // Shared props for the two bike-measurement phases (avant / après).
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
      <StudyStepper current={store.step} onStepClick={goToStep} />

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
          comments={store.physioComments}
          onSetValue={store.setPhysioValue}
          onSetComment={store.setPhysioComment}
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
        <RiderMeasuresForm
          riderMeasurements={riderMeasurements}
          bikeTypeId={store.bikeTypeId}
          values={store.riderMeasureValues}
          extraRiderMeasurementIds={store.extraRiderMeasurementIds}
          onSetValue={store.setRiderMeasureValue}
          onAddExtra={store.addExtraRiderMeasurement}
          onRemoveExtra={store.removeExtraRiderMeasurement}
          onBack={() => store.setStep(3)}
          onNext={() => advanceTo(5)}
          onSaveDraft={handleSaveDraft}
          saving={saving}
        />
      )}

      {store.step === 5 && (
        <MeasuresForm
          {...measureStepProps}
          phase="after"
          onBack={() => store.setStep(4)}
          onNext={() => advanceTo(6)}
        />
      )}

      {store.step === 6 && (
        <ComponentPicker
          components={components}
          bikeTypeId={store.bikeTypeId}
          selected={store.selectedComponentIds}
          onToggle={store.toggleComponent}
          onBack={() => store.setStep(5)}
          onNext={() => advanceTo(7)}
        />
      )}

      {store.step === 7 && (
        <ExercisePicker
          exercises={exercises}
          components={components}
          selected={store.selectedExerciseIds}
          selectedComponentIds={store.selectedComponentIds}
          measureCount={measureValuesToArray(store.measureValues).length}
          onToggle={store.toggleExercise}
          onBack={() => store.setStep(6)}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  );
}
