import { create } from "zustand";
import type { StudyMeasureValue, StudyRiderMeasureValue } from "@/types";
import type { PhysioValue, StudyPhysioResult } from "@/lib/physio";

// Steps: 1 Vélo · 2 Tests physio · 3 Mesures vélo avant · 4 Mesures cycliste ·
// 5 Mesures vélo après · 6 Composants · 7 Exercices
export type StudyStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
  // Mesures du cycliste saisies, indexées par riderMeasurementId. Avant et après
  // sont saisis sur la même étape.
  riderMeasureValues: Record<string, { before: number | null; after: number | null }>;
  // Mesures du cycliste ajoutées à la volée pour CETTE étude uniquement.
  extraRiderMeasurementIds: string[];
  // Résultat (unique) des tests physio, indexé par physioTestId. La valeur est
  // number|boolean|string|null selon l'outputType du test.
  physioResults: Record<string, PhysioValue>;
  // Commentaire libre optionnel par test physio (accordéon), indexé par physioTestId.
  physioComments: Record<string, string>;
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
  setRiderMeasureValue: (riderMeasurementId: string, field: "before" | "after", value: number | null) => void;
  addExtraRiderMeasurement: (riderMeasurementId: string) => void;
  removeExtraRiderMeasurement: (riderMeasurementId: string) => void;
  setPhysioValue: (physioTestId: string, value: PhysioValue) => void;
  setPhysioComment: (physioTestId: string, comment: string) => void;
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
  riderMeasureValues: {},
  extraRiderMeasurementIds: [],
  physioResults: {},
  physioComments: {},
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

/** Serialises the riderMeasureValues map into the array shape the action expects. */
export function riderMeasureValuesToArray(
  values: StudyStoreState["riderMeasureValues"]
): StudyRiderMeasureValue[] {
  return Object.entries(values)
    .filter(([, v]) => v.before != null || v.after != null)
    .map(([riderMeasurementId, v]) => ({ riderMeasurementId, before: v.before, after: v.after }));
}

/**
 * Serialises the physio results + comments maps into the array shape the action
 * expects. Keeps any test that has a value OR a comment.
 */
export function physioResultsToArray(
  results: StudyStoreState["physioResults"],
  comments: StudyStoreState["physioComments"] = {}
): StudyPhysioResult[] {
  const hasValue = (v: PhysioValue) => v !== null && v !== undefined && v !== "";
  const ids = new Set([
    ...Object.keys(results).filter((id) => hasValue(results[id])),
    ...Object.keys(comments).filter((id) => comments[id]?.trim()),
  ]);
  return [...ids].map((physioTestId) => {
    const value = hasValue(results[physioTestId]) ? results[physioTestId] : null;
    const comment = comments[physioTestId]?.trim() || null;
    return { physioTestId, value, comment };
  });
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

  setRiderMeasureValue: (riderMeasurementId, field, value) =>
    set((s) => ({
      riderMeasureValues: {
        ...s.riderMeasureValues,
        [riderMeasurementId]: {
          before: s.riderMeasureValues[riderMeasurementId]?.before ?? null,
          after: s.riderMeasureValues[riderMeasurementId]?.after ?? null,
          [field]: value,
        },
      },
    })),

  addExtraRiderMeasurement: (riderMeasurementId) =>
    set((s) =>
      s.extraRiderMeasurementIds.includes(riderMeasurementId)
        ? s
        : { extraRiderMeasurementIds: [...s.extraRiderMeasurementIds, riderMeasurementId] }
    ),

  removeExtraRiderMeasurement: (riderMeasurementId) =>
    set((s) => {
      // Drop the row and any values typed into it.
      const riderMeasureValues = { ...s.riderMeasureValues };
      delete riderMeasureValues[riderMeasurementId];
      return {
        extraRiderMeasurementIds: s.extraRiderMeasurementIds.filter((id) => id !== riderMeasurementId),
        riderMeasureValues,
      };
    }),

  setPhysioValue: (physioTestId, value) =>
    set((s) => ({
      physioResults: { ...s.physioResults, [physioTestId]: value },
    })),

  setPhysioComment: (physioTestId, comment) =>
    set((s) => ({
      physioComments: { ...s.physioComments, [physioTestId]: comment },
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
