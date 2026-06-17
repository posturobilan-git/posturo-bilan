import { z } from "zod";

export const measurementSchema = z
  .object({
    name: z.string().min(1, "Le nom est requis").max(120),
    unit: z.string().min(1, "L'unité est requise").max(20),
    category: z
      .enum(["SELLE", "CINTRE", "POTENCE", "POSITION", "CALE_PIEDS", "MANIVELLES", "AUTRE"])
      .default("AUTRE"),
    isCommon: z.boolean().default(false),
    isRequired: z.boolean().default(false),
    bikeTypeIds: z.array(z.string().uuid()).default([]),
  })
  .refine((d) => d.isCommon || d.bikeTypeIds.length > 0, {
    message: "Cochez « Tronc commun » ou sélectionnez au moins un type de vélo.",
    path: ["bikeTypeIds"],
  });

export type MeasurementInput = z.infer<typeof measurementSchema>;
