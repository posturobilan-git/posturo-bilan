import { create } from "zustand";
import type { StudyMeasureValue, StudyRiderMeasureValue, StudyPainInput } from "@/types";
import type { PhysioValue, StudyPhysioResult } from "@/lib/physio";

// Steps: 1 Vélo · 2 Douleurs · 3 Tests physio · 4 Mesures vélo avant ·
// 5 Mesures cycliste · 6 Mesures vélo après · 7 Composants · 8 Exercices ·
// 9 Récapitulatif & bilan
export type StudyStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * Une douleur en cours de saisie. Identique à StudyPainInput mais avec une clé
 * locale stable (`key`) pour le rendu React, indépendante de la persistance.
 */
export interface PainDraft extends StudyPainInput {
  key: string;
}

let painKeySeq = 0;
/** Crée un bloc douleur vierge (ou pré-rempli) avec une clé locale stable. */
export function makePainDraft(partial: Partial<StudyPainInput> = {}): PainDraft {
  return {
    key: `pain-${painKeySeq++}`,
    location: "",
    type: "",
    intensity: "",
    restAtRest: false,
    activity: "",
    duration: "",
    aggravatingFactors: "",
    relievingFactors: "",
    ...partial,
  };
}

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
  // Douleurs structurées (étape Douleurs), dans l'ordre d'affichage.
  pains: PainDraft[];
  observations: string;
  // Étape Récapitulatif & bilan.
  summary: string;
  recommendations: string;
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
  addPain: () => void;
  removePain: (key: string) => void;
  setPainField: <K extends keyof StudyPainInput>(key: string, field: K, value: StudyPainInput[K]) => void;
  setObservations: (text: string) => void;
  setSummary: (text: string) => void;
  setRecommendations: (text: string) => void;
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
  pains: [],
  observations: "",
  summary: "",
  recommendations: "",
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

/**
 * Serialises the pain drafts into the shape the action expects. Drops blocks
 * with no `location` (empty rows the kiné never filled) and trims every field.
 */
export function painsToArray(pains: PainDraft[]): StudyPainInput[] {
  const clean = (s: string) => {
    const t = s.trim();
    return t === "" ? undefined : t;
  };
  return pains
    .filter((p) => p.location.trim() !== "")
    .map((p) => ({
      location: p.location.trim(),
      type: clean(p.type ?? ""),
      intensity: clean(p.intensity ?? ""),
      restAtRest: p.restAtRest,
      activity: clean(p.activity ?? ""),
      duration: clean(p.duration ?? ""),
      aggravatingFactors: clean(p.aggravatingFactors ?? ""),
      relievingFactors: clean(p.relievingFactors ?? ""),
    }));
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

  addPain: () => set((s) => ({ pains: [...s.pains, makePainDraft()] })),

  removePain: (key) =>
    set((s) => ({ pains: s.pains.filter((p) => p.key !== key) })),

  setPainField: (key, field, value) =>
    set((s) => ({
      pains: s.pains.map((p) => (p.key === key ? { ...p, [field]: value } : p)),
    })),

  setObservations: (observations) => set({ observations }),

  setSummary: (summary) => set({ summary }),

  setRecommendations: (recommendations) => set({ recommendations }),

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
