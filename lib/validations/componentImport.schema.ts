import { z } from "zod";

// Validation structurelle uniquement (uuids bien formés, componentId présent pour
// une mise à jour) : la correction sémantique des valeurs (options SELECT valides,
// nombres bien formés...) a déjà été résolue à l'étape de prévisualisation
// (previewComponentImport) et n'est pas re-dérivée ici.
const importRowSchema = z
  .object({
    // 1-based, matches the source row in the parsed file — carried through purely
    // for error reporting if this row's write fails.
    rowNumber: z.number().int().positive(),
    action: z.enum(["create", "update"]),
    componentId: z.string().uuid().optional(),
    name: z.string().min(1),
    brand: z.string().optional(),
    model: z.string().optional(),
    bikeTypeIds: z.array(z.string().uuid()).default([]),
    attributeValues: z
      .array(z.object({ attributeId: z.string().uuid(), value: z.string() }))
      .default([]),
  })
  .refine((r) => r.action !== "update" || Boolean(r.componentId), {
    message: "componentId requis pour une mise à jour.",
    path: ["componentId"],
  });

export const confirmComponentImportSchema = z.object({
  categoryId: z.string().uuid(),
  rows: z.array(importRowSchema),
  // Attribut ids dont la colonne était présente dans le fichier (header-level,
  // pas par ligne) — une colonne absente ne doit jamais effacer une valeur déjà
  // en base pour cet attribut. Voir confirmComponentImport.
  presentAttributeIds: z.array(z.string().uuid()).default([]),
});

export type ConfirmComponentImportInput = z.infer<typeof confirmComponentImportSchema>;
export type ImportRowInput = z.infer<typeof importRowSchema>;
