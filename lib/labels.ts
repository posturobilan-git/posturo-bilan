import type {
  ExerciseCategory,
  ComponentAttributeType,
  StudyStatus,
  MeasurementCategory,
  PhysioOutputType,
  PhotoPhase,
  PhotoAngle,
} from "@prisma/client";

export const PHYSIO_OUTPUT_TYPE_LABELS: Record<PhysioOutputType, string> = {
  YES_NO: "Oui / Non",
  POSITIVE_NEGATIVE: "Positif / Négatif",
  VALUE: "Valeur",
};

export const PHYSIO_OUTPUT_TYPES = Object.keys(
  PHYSIO_OUTPUT_TYPE_LABELS
) as PhysioOutputType[];

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

// Photos patient (prompt 25).
export const PHOTO_PHASE_LABELS: Record<PhotoPhase, string> = {
  BEFORE: "Avant réglage",
  AFTER: "Après réglage",
};

export const PHOTO_ANGLE_LABELS: Record<PhotoAngle, string> = {
  SIDE: "Profil",
  FRONT: "Face",
  BACK: "Dos",
};

export const PHOTO_ANGLES = Object.keys(PHOTO_ANGLE_LABELS) as PhotoAngle[];

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

export const EXERCISE_CATEGORIES = Object.keys(EXERCISE_CATEGORY_LABELS) as ExerciseCategory[];
// Component categories are now an admin-managed model (see actions/componentCategory.actions.ts),
// not a static enum — no label map here anymore. Fetch via getCategories()/getActiveCategories().

export const COMPONENT_ATTRIBUTE_TYPE_LABELS: Record<ComponentAttributeType, string> = {
  NUMBER: "Nombre",
  TEXT: "Texte",
  BOOLEAN: "Oui / Non",
  SELECT: "Liste",
};

export const COMPONENT_ATTRIBUTE_TYPES = Object.keys(
  COMPONENT_ATTRIBUTE_TYPE_LABELS
) as ComponentAttributeType[];
