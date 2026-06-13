import { z } from "zod";

/**
 * Public J+30 follow-up form submitted by the patient via the tokenised
 * `/suivi/[token]` link. All fields optional — the patient answers what they
 * can.
 */
export const followupFormSchema = z.object({
  painLevel: z.number().int().min(0).max(10).optional(),
  comfortScore: z.number().int().min(0).max(10).optional(),
  satisfactionScore: z.number().int().min(0).max(10).optional(),
  ridingFrequency: z.string().max(200).optional(),
  generalFeedback: z.string().max(2000).optional(),
});

export type FollowupFormInput = z.infer<typeof followupFormSchema>;
