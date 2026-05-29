import type { ExerciseCategory, ComponentCategory } from "@prisma/client";

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
