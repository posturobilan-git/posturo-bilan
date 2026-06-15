import { z } from "zod";

/** Manual intake entered by the kiné directly in the app (no webhook). */
export const manualIntakeSchema = z.object({
  heightCm: z.number().min(50).max(250).optional(),
  weightKg: z.number().min(20).max(300).optional(),
  bikeType: z.string().optional(),
  ridingLevel: z.string().optional(),
  weeklyHours: z.number().min(0).max(60).optional(),
  yearsRiding: z.number().int().min(0).max(100).optional(),
  injuries: z.array(z.string().min(1)).default([]),
  goals: z.string().max(2000).optional(),
  medicalNotes: z.string().max(2000).optional(),
});

/**
 * Public "formulaire d'accueil" submitted by the patient themselves via the
 * tokenised link. Same fields as the manual intake, plus mandatory consent to
 * the CGU before the data can be saved.
 */
export const accueilFormSchema = manualIntakeSchema.extend({
  cguAccepted: z.boolean().refine((v) => v === true, {
    message: "Vous devez accepter les conditions pour continuer.",
  }),
});

export type AccueilFormInput = z.infer<typeof accueilFormSchema>;
