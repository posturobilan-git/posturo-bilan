import { z } from "zod";

// Une valeur de côte : avant/après. Les deux sont optionnels (saisie partielle
// autorisée en brouillon).
export const studyMeasureValueSchema = z.object({
  measurementId: z.string().uuid(),
  before: z.number().nullable().optional(),
  after: z.number().nullable().optional(),
});

// Un résultat de test physio : une seule valeur, dont le type dépend de
// l'outputType du test (number pour VALUE, boolean pour YES_NO, string pour COMMENT).
export const studyPhysioResultSchema = z.object({
  physioTestId: z.string().uuid(),
  value: z.union([z.number(), z.boolean(), z.string().max(2000)]).nullable().optional(),
});

export const studySchema = z.object({
  patientId: z.string().uuid(),
  draftStudyId: z.string().uuid().optional(),
  bikeTypeId: z.string().uuid({ message: "Sélectionnez un type de vélo." }),
  measureValues: z.array(studyMeasureValueSchema).default([]),
  physioResults: z.array(studyPhysioResultSchema).default([]),
  observations: z.string().max(3000).optional(),
  componentIds: z.array(z.string().uuid()),
  exerciseIds: z.array(z.string().uuid()),
});
