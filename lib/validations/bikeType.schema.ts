import { z } from "zod";

export const bikeTypeSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(100),
});

export type BikeTypeInput = z.infer<typeof bikeTypeSchema>;

/**
 * Liste ordonnée d'ids d'éléments configurés pour un type de vélo (côtes, mesures
 * du cycliste ou tests physio), telle qu'envoyée par l'écran de configuration.
 */
export const configIdsSchema = z.array(z.string().uuid()).max(500);
