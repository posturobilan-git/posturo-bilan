import { create } from "zustand";
import type { StudyMeasureValue } from "@/types";
import type { PhysioValue, StudyPhysioResult } from "@/lib/physio";

// Steps: 1 Vélo · 2 Tests physio · 3 Mesures avant · 4 Mesures après ·
// 5 Composants · 6 Exercices
export type StudyStep = 1 | 2 | 3 | 4 | 5 | 6;

interface StudyStoreState {
  patientId: string;
  step: StudyStep;
  draftStudyId: string | null;
  bikeTypeId: string | null;
  // Côtes saisies, indexées par measurementId pour une mise à jour O(1).
  measureValues: Record<string, { before: number | null; after: number | null }>;
  // Côtes ajoutées à la volée pour CETTE étude uniquement (hors configuration
  // du type de vélo), dans l'ordre d'ajout.
  extraMeasurementIds: string[];
  // Résultat (unique) des tests physio, indexé par physioTestId. La valeur est
  // number|boolean|string|null selon l'outputType du test.
  physioResults: Record<string, PhysioValue>;
  observations: string;
  selectedComponentIds: string[];
  selectedExerciseIds: string[];
}

interface StudyStoreActions {
  init: (patientId: string, initial?: Partial<StudyStoreState>) => void;
  setStep: (step: StudyStep) => void;
  setBikeTypeId: (id: string | null) => void;
  setMeasureValue: (measurementId: string, field: "before" | "after", value: number | null) => void;
  addExtraMeasurement: (measurementId: string) => void;
  removeExtraMeasurement: (measurementId: string) => void;
  setPhysioValue: (physioTestId: string, value: PhysioValue) => void;
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
  extraMeasurementIds: [],
  physioResults: {},
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

/** Serialises the physioResults map into the array shape the action expects. */
export function physioResultsToArray(
  results: StudyStoreState["physioResults"]
): StudyPhysioResult[] {
  return Object.entries(results)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([physioTestId, value]) => ({ physioTestId, value }));
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

  addExtraMeasurement: (measurementId) =>
    set((s) =>
      s.extraMeasurementIds.includes(measurementId)
        ? s
        : { extraMeasurementIds: [...s.extraMeasurementIds, measurementId] }
    ),

  removeExtraMeasurement: (measurementId) =>
    set((s) => {
      // Drop the row and any values typed into it.
      const measureValues = { ...s.measureValues };
      delete measureValues[measurementId];
      return {
        extraMeasurementIds: s.extraMeasurementIds.filter((id) => id !== measurementId),
        measureValues,
      };
    }),

  setPhysioValue: (physioTestId, value) =>
    set((s) => ({
      physioResults: { ...s.physioResults, [physioTestId]: value },
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
