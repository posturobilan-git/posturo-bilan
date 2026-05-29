import { create } from "zustand";
import type { StudyMeasures } from "@/types";

const EMPTY_MEASURES: StudyMeasures = {
  saddleHeight: undefined,
  saddleSetback: undefined,
  saddleAngle: undefined,
  saddleModel: undefined,
  handlebarHeight: undefined,
  stemLength: undefined,
  stemAngle: undefined,
  handlebarWidth: undefined,
  effectiveReach: undefined,
  trunkAngle: undefined,
  kneeAngle: undefined,
  cleatAngle: undefined,
  cleatPosition: undefined,
  crankLength: undefined,
  observations: undefined,
};

interface StudyStoreState {
  patientId: string;
  step: 1 | 2 | 3;
  draftStudyId: string | null;
  measures: StudyMeasures;
  selectedComponentIds: string[];
  selectedExerciseIds: string[];
}

interface StudyStoreActions {
  init: (patientId: string, initial?: Partial<StudyStoreState>) => void;
  setStep: (step: 1 | 2 | 3) => void;
  setMeasures: (measures: StudyMeasures) => void;
  toggleComponent: (id: string) => void;
  toggleExercise: (id: string) => void;
  setDraftStudyId: (id: string | null) => void;
  reset: () => void;
}

const DEFAULT_STATE: StudyStoreState = {
  patientId: "",
  step: 1,
  draftStudyId: null,
  measures: EMPTY_MEASURES,
  selectedComponentIds: [],
  selectedExerciseIds: [],
};

export const useStudyStore = create<StudyStoreState & StudyStoreActions>((set) => ({
  ...DEFAULT_STATE,

  init: (patientId, initial = {}) =>
    set({ ...DEFAULT_STATE, patientId, ...initial }),

  setStep: (step) => set({ step }),

  setMeasures: (measures) => set({ measures }),

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
