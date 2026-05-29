import { z } from "zod";

export const exerciseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.enum(["SOUPLESSE", "RENFORCEMENT", "MOBILITE", "PROPRIOCEPTION", "AUTRE"]).default("AUTRE"),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  mediaUrl: z.string().url().optional().or(z.literal("")),
});
