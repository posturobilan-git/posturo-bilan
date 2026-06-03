import { create } from "zustand";
import type { StudyMeasureValue } from "@/types";

// Steps: 1 Vélo · 2 Mesures · 3 Composants · 4 Exercices
export type StudyStep = 1 | 2 | 3 | 4;

interface StudyStoreState {
  patientId: string;
  step: StudyStep;
  draftStudyId: string | null;
  bikeTypeId: string | null;
  // Côtes saisies, indexées par measurementId pour une mise à jour O(1).
  measureValues: Record<string, { before: number | null; after: number | null }>;
  observations: string;
  selectedComponentIds: string[];
  selectedExerciseIds: string[];
}

interface StudyStoreActions {
  init: (patientId: string, initial?: Partial<StudyStoreState>) => void;
  setStep: (step: StudyStep) => void;
  setBikeTypeId: (id: string | null) => void;
  setMeasureValue: (measurementId: string, field: "before" | "after", value: number | null) => void;
  setObservations: (text: string) => void;
  toggleComponent: (id: string) => void;
  toggleExercise: (id: string) => void;
  setDraftStudyId: (id: string | null) => void;
  reset: () => void;
}

const DEFAULT_STATE: StudyStoreState = {
  patientId: "",
  step: 1,
  draftStudyId: null,
  bikeTypeId: null,
  measureValues: {},
  observations: "",
  selectedComponentIds: [],
  selectedExerciseIds: [],
};

/** Serialises the measureValues map into the array shape the action expects. */
export function measureValuesToArray(
  values: StudyStoreState["measureValues"]
): StudyMeasureValue[] {
  return Object.entries(values)
    .filter(([, v]) => v.before != null || v.after != null)
    .map(([measurementId, v]) => ({ measurementId, before: v.before, after: v.after }));
}

export const useStudyStore = create<StudyStoreState & StudyStoreActions>((set) => ({
  ...DEFAULT_STATE,

  init: (patientId, initial = {}) =>
    set({ ...DEFAULT_STATE, patientId, ...initial }),

  setStep: (step) => set({ step }),

  setBikeTypeId: (bikeTypeId) => set({ bikeTypeId }),

  setMeasureValue: (measurementId, field, value) =>
    set((s) => ({
      measureValues: {
        ...s.measureValues,
        [measurementId]: {
          before: s.measureValues[measurementId]?.before ?? null,
          after: s.measureValues[measurementId]?.after ?? null,
          [field]: value,
        },
      },
    })),

  setObservations: (observations) => set({ observations }),

  toggleComponent: (id) =>
    set((s) => ({
      selectedComponentIds: s.selectedComponentIds.includes(id)
        ? s.selectedComponentIds.filter((c) => c !== id)
        : [...s.selectedComponentIds, id],
    })),

  toggleExercise: (id) =>
    set((s) => ({
      selectedExerciseIds: s.selectedExerciseIds.includes(id)
        ? s.selectedExerciseIds.filter((e) => e !== id)
        : [...s.selectedExerciseIds, id],
    })),

  setDraftStudyId: (id) => set({ draftStudyId: id }),

  reset: () => set(DEFAULT_STATE),
}));
