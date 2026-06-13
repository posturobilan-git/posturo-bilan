"use server";

import { prisma } from "@/lib/db";
import { followupFormSchema, type FollowupFormInput } from "@/lib/validations/followup.schema";
import { logAudit } from "@/lib/audit";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";

/**
 * Public submission of the J+30 follow-up form by the patient.
 *
 * No Clerk session — authorization is the possession of the per-study follow-up
 * token. Records a `Followup` for the patient, marks the study
 * `followup_completed`, and stamps `followupCompletedAt` (the token is kept so a
 * revisit shows "déjà complété" rather than "invalide").
 */
export async function submitFollowupForm(
  token: string,
  data: FollowupFormInput
): Promise<ActionResult<void>> {
  const parsed = followupFormSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));
  const r = parsed.data;

  try {
    const study = await prisma.study.findUnique({
      where: { followupToken: token },
      select: {
        id: true,
        kineId: true,
        patientId: true,
        followupCompletedAt: true,
        patient: { select: { isAnonymized: true } },
      },
    });

    if (!study) return fail("Lien invalide.");
    if (study.patient.isAnonymized) return fail("Ce dossier n'est plus disponible.");
    if (study.followupCompletedAt) return fail("Ce formulaire a déjà été complété.");

    await prisma.$transaction([
      prisma.followup.create({
        data: {
          patientId: study.patientId,
          source: "custom_form",
          painLevel: r.painLevel,
          comfortScore: r.comfortScore,
          satisfactionScore: r.satisfactionScore,
          ridingFrequency: r.ridingFrequency,
          generalFeedback: r.generalFeedback,
        },
      }),
      prisma.study.update({
        where: { id: study.id },
        data: { status: "followup_completed", followupCompletedAt: new Date() },
      }),
    ]);

    await logAudit({
      userId: study.kineId,
      action: "CREATE",
      entity: "followup",
      entityId: study.id,
      metadata: { source: "custom_form" },
    });

    return ok(undefined);
  } catch (e) {
    console.error("submitFollowupForm failed:", e);
    return fail("Impossible d'enregistrer le formulaire. Réessayez.");
  }
}
