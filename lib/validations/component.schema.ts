import { z } from "zod";

export const componentSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().optional(),
  model: z.string().optional(),
  category: z.enum(["SELLE", "POTENCE", "CINTRE", "CALE_PIEDS", "MANIVELLES", "PEDALES", "AUTRE"]).default("AUTRE"),
  notes: z.string().optional(),
});
