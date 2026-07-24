import { z } from "zod";

export const componentAttributeSchema = z
  .object({
    name: z.string().min(1, "Le nom est requis").max(120),
    key: z.string().min(1, "La clé est requise").max(80),
    type: z.enum(["NUMBER", "TEXT", "BOOLEAN", "SELECT"]).default("TEXT"),
    // Requise uniquement pour un attribut de type NUMBER.
    unit: z.string().max(20).optional(),
    // Requises uniquement pour un attribut de type SELECT.
    options: z.array(z.string().min(1)).default([]),
    isRequired: z.boolean().default(false),
  })
  .refine((d) => d.type !== "SELECT" || d.options.length >= 1, {
    message: "Au moins une option est requise pour un attribut de type liste.",
    path: ["options"],
  });

export type ComponentAttributeInput = z.infer<typeof componentAttributeSchema>;
