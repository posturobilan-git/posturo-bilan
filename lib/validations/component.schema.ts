import { z } from "zod";

export const componentSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().optional(),
  model: z.string().optional(),
  categoryId: z.string().uuid(),
  notes: z.string().optional(),
  // Types de vélo compatibles. Vide = composant universel (tous les vélos).
  bikeTypeIds: z.array(z.string().uuid()).default([]),
  // Valeurs brutes (string) des attributs configurés pour la catégorie ; coercées
  // et validées côté serveur selon le type de chaque ComponentAttribute (prompt 27).
  attributeValues: z
    .array(z.object({ attributeId: z.string().uuid(), value: z.string() }))
    .default([]),
});
