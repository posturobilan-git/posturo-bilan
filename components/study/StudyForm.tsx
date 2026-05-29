"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useStudyStore } from "@/lib/stores/studyStore";
import { toast } from "@/lib/stores/toastStore";
import { saveDraftStudy, submitStudy } from "@/actions/study.actions";
import { StudyStepper } from "./StudyStepper";
import { MeasuresForm } from "./MeasuresForm";
import { ComponentPicker } from "./ComponentPicker";
import { ExercisePicker } from "./ExercisePicker";
import type { BikeComponent, Exercise, Patient, PatientIntake } from "@prisma/client";
import type { StudyMeasures } from "@/types";

interface Props {
  patient: Patient & { intake: PatientIntake | null };
  components: BikeComponent[];
  exercises: Exercise[];
  /** Pre-filled from an existing study, if any */
  initial?: {
    studyId: string;
    measures: StudyMeasures;
    componentIds: string[];
    exerciseIds: string[];
  };
}

export function StudyForm({ patient, components, exercises, initial }: Props) {
  const router = useRouter();
  const store = useStudyStore();
  const [saving, startSave] = useTransition();
  const [submitting, startSubmit] = useTransition();

  // Initialize store once per patient (handles navigation between patients).
  // MeasuresForm reads measures directly from the store, so it picks up
  // these values on the re-render that follows init — no stale local state.
  useEffect(() => {
    store.init(patient.id, {
      draftStudyId: initial?.studyId ?? null,
      measures: initial?.measures ?? {},
      selectedComponentIds: initial?.componentIds ?? [],
      selectedExerciseIds: initial?.exerciseIds ?? [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id]);

  // ── Persistence helper ──────────────────────────────────────────────────────

  /** Saves the current store state as a draft. Returns true on success. */
  async function persistDraft(): Promise<boolean> {
    const result = await saveDraftStudy({
      patientId: patient.id,
      draftStudyId: store.draftStudyId ?? undefined,
      measures: store.measures,
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

  // ── Step 1: measures ──────────────────────────────────────────────────────

  function handleSaveDraft() {
    startSave(async () => {
      if (await persistDraft()) toast.success("Brouillon enregistré.");
    });
  }

  function handleAdvanceFromStep1() {
    startSave(async () => {
      if (await persistDraft()) store.setStep(2);
    });
  }

  // ── Step 2: components ──────────────────────────────────────────────────────

  function handleAdvanceFromStep2() {
    startSave(async () => {
      if (await persistDraft()) store.setStep(3);
    });
  }

  // ── Step 3: submit ──────────────────────────────────────────────────────────

  function handleSubmit() {
    startSubmit(async () => {
      const result = await submitStudy({
        patientId: patient.id,
        draftStudyId: store.draftStudyId ?? undefined,
        measures: store.measures,
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
        <MeasuresForm
          values={store.measures}
          onChange={store.setMeasures}
          onNext={handleAdvanceFromStep1}
          onSaveDraft={handleSaveDraft}
          saving={saving}
        />
      )}

      {store.step === 2 && (
        <ComponentPicker
          components={components}
          selected={store.selectedComponentIds}
          onToggle={store.toggleComponent}
          onBack={() => store.setStep(1)}
          onNext={handleAdvanceFromStep2}
        />
      )}

      {store.step === 3 && (
        <ExercisePicker
          exercises={exercises}
          components={components}
          selected={store.selectedExerciseIds}
          selectedComponentIds={store.selectedComponentIds}
          measures={store.measures}
          onToggle={store.toggleExercise}
          onBack={() => store.setStep(2)}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  );
}
