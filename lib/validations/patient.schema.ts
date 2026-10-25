import { z } from "zod";
import { phoneSchema } from "./phone.schema";

// ─── CRUD (prompt 11) ──────────────────────────────────────────────────────────

// Le téléphone est obligatoire (prompt 28), normalisé en E.164. La colonne reste
// nullable : un patient créé par le webhook de réservation, ou antérieur à cette
// règle, peut ne pas en avoir — l'édition l'exige alors à la prochaine modification.
export const createPatientSchema = z.object({
  firstName: z.string().min(1, "Prénom requis").max(100),
  lastName: z.string().min(1, "Nom requis").max(100),
  email: z.string().email("Email invalide"),
  phone: phoneSchema,
  // Champ ADMIN uniquement — assigner à un autre kiné. Ignoré pour un KINE.
  kineId: z.string().uuid().optional(),
});

export const updatePatientSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: phoneSchema,
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
