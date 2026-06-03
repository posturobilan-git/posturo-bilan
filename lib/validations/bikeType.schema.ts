import { z } from "zod";

export const bikeTypeSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(100),
});

export type BikeTypeInput = z.infer<typeof bikeTypeSchema>;
