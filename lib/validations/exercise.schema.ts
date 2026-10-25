import { z } from "zod";

export const exerciseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1),
  // Catégorie gérée par l'admin (voir actions/exerciseCategory.actions.ts).
  categoryId: z.string().uuid("Choisissez une catégorie."),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  mediaUrl: z.string().url().optional().or(z.literal("")),
});

export type ExerciseInput = z.infer<typeof exerciseSchema>;
