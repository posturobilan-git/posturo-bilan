import { z } from "zod";

export const studyMeasuresSchema = z.object({
  // Selle (required for final submit, validated in form before advancing)
  saddleHeight: z.number().min(50).max(120).optional(),
  saddleSetback: z.number().min(0).max(200).optional(),
  saddleAngle: z.number().min(-10).max(10).optional(),
  saddleModel: z.string().optional(),

  // Cintre / potence
  handlebarHeight: z.number().optional(),
  stemLength: z.number().optional(),
  stemAngle: z.number().optional(),
  handlebarWidth: z.number().optional(),

  // Position corps
  effectiveReach: z.number().optional(),
  trunkAngle: z.number().optional(),
  kneeAngle: z.number().optional(),

  // Cale-pieds
  cleatAngle: z.number().min(-15).max(15).optional(),
  cleatPosition: z.string().optional(),

  // Manivelles
  crankLength: z.number().optional(),

  // Observations
  observations: z.string().max(3000).optional(),
});

export const studySchema = z.object({
  patientId: z.string().uuid(),
  draftStudyId: z.string().uuid().optional(),
  measures: studyMeasuresSchema,
  componentIds: z.array(z.string().uuid()),
  exerciseIds: z.array(z.string().uuid()),
});
