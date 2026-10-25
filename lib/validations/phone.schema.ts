import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

/**
 * Téléphone obligatoire d'un patient : non vide, valide, converti en E.164 (voir
 * lib/phone.ts). Les messages se lisent après « Téléphone : » (formatZodError).
 */
export const phoneSchema = z
  .string({ error: "numéro requis." })
  .trim()
  .refine((v) => v.length > 0, { error: "numéro requis." })
  .refine((v) => v.length === 0 || normalizePhone(v) !== null, {
    error: "numéro invalide (ex. 06 12 34 56 78, ou +41 79 123 45 67 pour un numéro étranger).",
  })
  .transform((v) => normalizePhone(v) as string);
