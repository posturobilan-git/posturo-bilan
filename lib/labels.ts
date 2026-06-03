import type {
  ExerciseCategory,
  ComponentCategory,
  StudyStatus,
  MeasurementCategory,
} from "@prisma/client";

export const MEASUREMENT_CATEGORY_LABELS: Record<MeasurementCategory, string> = {
  SELLE: "Selle",
  CINTRE: "Cintre",
  POTENCE: "Potence",
  POSITION: "Position",
  CALE_PIEDS: "Cale-pieds",
  MANIVELLES: "Manivelles",
  AUTRE: "Autre",
};

export const MEASUREMENT_CATEGORIES = Object.keys(
  MEASUREMENT_CATEGORY_LABELS
) as MeasurementCategory[];

export const STUDY_STATUS_LABELS: Record<StudyStatus, string> = {
  study_pending: "Étude à faire",
  study_completed: "Étude terminée",
  report_sent: "Rapport envoyé",
  followup_pending: "Suivi en attente",
  followup_completed: "Suivi complété",
};

export const STUDY_STATUSES = Object.keys(STUDY_STATUS_LABELS) as StudyStatus[];

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  SOUPLESSE: "Souplesse",
  RENFORCEMENT: "Renforcement",
  MOBILITE: "Mobilité",
  PROPRIOCEPTION: "Proprioception",
  AUTRE: "Autre",
};

export const COMPONENT_CATEGORY_LABELS: Record<ComponentCategory, string> = {
  SELLE: "Selle",
  POTENCE: "Potence",
  CINTRE: "Cintre",
  CALE_PIEDS: "Cale-pieds",
  MANIVELLES: "Manivelles",
  PEDALES: "Pédales",
  AUTRE: "Autre",
};

export const EXERCISE_CATEGORIES = Object.keys(EXERCISE_CATEGORY_LABELS) as ExerciseCategory[];
export const COMPONENT_CATEGORIES = Object.keys(COMPONENT_CATEGORY_LABELS) as ComponentCategory[];
