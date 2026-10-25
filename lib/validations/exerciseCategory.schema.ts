import { z } from "zod";

export const exerciseCategorySchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(60),
});

export type ExerciseCategoryInput = z.infer<typeof exerciseCategorySchema>;
