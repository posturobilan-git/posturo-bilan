import { z } from "zod";

// Une valeur de côte : avant/après. Les deux sont optionnels (saisie partielle
// autorisée en brouillon).
export const studyMeasureValueSchema = z.object({
  measurementId: z.string().uuid(),
  before: z.number().nullable().optional(),
  after: z.number().nullable().optional(),
});

// Une valeur de mesure du cycliste : avant/après. Les deux sont saisis sur la
// même étape ; tous deux optionnels (saisie partielle autorisée en brouillon).
export const studyRiderMeasureValueSchema = z.object({
  riderMeasurementId: z.string().uuid(),
  before: z.number().nullable().optional(),
  after: z.number().nullable().optional(),
});

// Un résultat de test physio : une seule valeur, dont le type dépend de
// l'outputType du test (number pour VALUE, boolean pour YES_NO / POSITIVE_NEGATIVE),
// plus un commentaire libre optionnel commun à tous les types.
export const studyPhysioResultSchema = z.object({
  physioTestId: z.string().uuid(),
  value: z.union([z.number(), z.boolean(), z.string().max(2000)]).nullable().optional(),
  // Commentaire libre optionnel, indépendant du type de résultat.
  comment: z.string().max(2000).nullable().optional(),
});

// Une douleur structurée saisie pendant l'étude. Seul `location` est requis ;
// l'ordre (Douleur 1, 2, 3...) est dérivé de la position dans le tableau côté
// serveur. Les blocs sans `location` sont filtrés avant validation.
export const studyPainSchema = z.object({
  location: z.string().min(1, { message: "La localisation est requise." }).max(200),
  type: z.string().max(200).optional(),
  intensity: z.string().max(50).optional(),
  restAtRest: z.boolean().default(false),
  activity: z.string().max(500).optional(),
  duration: z.string().max(200).optional(),
  aggravatingFactors: z.string().max(1000).optional(),
  relievingFactors: z.string().max(1000).optional(),
});

export const studySchema = z.object({
  patientId: z.string().uuid(),
  draftStudyId: z.string().uuid().optional(),
  bikeTypeId: z.string().uuid({ message: "Sélectionnez un type de vélo." }),
  measureValues: z.array(studyMeasureValueSchema).default([]),
  riderMeasureValues: z.array(studyRiderMeasureValueSchema).default([]),
  physioResults: z.array(studyPhysioResultSchema).default([]),
  pains: z.array(studyPainSchema).default([]),
  observations: z.string().max(3000).optional(),
  summary: z.string().max(5000).optional(),
  recommendations: z.string().max(5000).optional(),
  componentIds: z.array(z.string().uuid()),
  exerciseIds: z.array(z.string().uuid()),
});
