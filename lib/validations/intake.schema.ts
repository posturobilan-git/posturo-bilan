import { z } from "zod";

/** Manual intake entered by the kiné directly in the app (no webhook). */
export const manualIntakeSchema = z.object({
  heightCm: z.number().min(50).max(250).optional(),
  weightKg: z.number().min(20).max(300).optional(),
  bikeType: z.string().optional(),
  ridingLevel: z.string().optional(),
  weeklyHours: z.number().min(0).max(60).optional(),
  yearsRiding: z.number().int().min(0).max(100).optional(),
  injuries: z.array(z.string().min(1)).default([]),
  goals: z.string().max(2000).optional(),
  medicalNotes: z.string().max(2000).optional(),
});

export const intakeSchema = z.object({
  source: z.string().default("google_forms"),
  calendlyEventId: z.string().optional(),
  kineId: z.string().uuid(),
  patient: z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    heightCm: z.number().optional(),
    weightKg: z.number().optional(),
    bikeType: z.string().optional(),
    ridingLevel: z.string().optional(),
    weeklyHours: z.number().optional(),
    yearsRiding: z.number().int().optional(),
    injuries: z.array(z.string()).default([]),
    goals: z.string().optional(),
    medicalNotes: z.string().optional(),
  }),
});
