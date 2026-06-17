import { z } from "zod";

export const physioTestSectionSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(80),
});

export type PhysioTestSectionInput = z.infer<typeof physioTestSectionSchema>;
