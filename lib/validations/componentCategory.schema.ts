import { z } from "zod";

export const componentCategorySchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(60),
});

export type ComponentCategoryInput = z.infer<typeof componentCategorySchema>;
