import { z } from "zod";

export const physioTestSchema = z
  .object({
    name: z.string().min(1, "Le nom est requis").max(120),
    description: z.string().max(1000).optional(),
    outputType: z.enum(["YES_NO", "COMMENT", "VALUE"]).default("VALUE"),
    // Requise uniquement pour un résultat de type valeur (VALUE).
    unit: z.string().max(20).optional(),
    isCommon: z.boolean().default(false),
    bikeTypeIds: z.array(z.string().uuid()).default([]),
  })
  .refine((d) => d.isCommon || d.bikeTypeIds.length > 0, {
    message: "Cochez « Tronc commun » ou sélectionnez au moins un type de vélo.",
    path: ["bikeTypeIds"],
  })
  .refine((d) => d.outputType !== "VALUE" || (d.unit?.trim().length ?? 0) > 0, {
    message: "L'unité est requise pour un résultat de type valeur.",
    path: ["unit"],
  });

export type PhysioTestInput = z.infer<typeof physioTestSchema>;
