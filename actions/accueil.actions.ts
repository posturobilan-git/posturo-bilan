"use server";

import { prisma } from "@/lib/db";
import { accueilFormSchema, type AccueilFormInput } from "@/lib/validations/intake.schema";
import { INTAKE_CGU_VERSION } from "@/lib/legal";
import { logAudit } from "@/lib/audit";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";

/**
 * Public submission of the "formulaire d'accueil" by the patient.
 *
 * No Clerk session here — authorization is the possession of the unguessable
 * invite token (a UUID). The token is validated, then the intake is saved and
 * the link is invalidated (`inviteCompletedAt` set). The token is kept so a
 * later visit can be told the form is already completed rather than "invalid".
 */
export async function submitAccueilForm(
  token: string,
  data: AccueilFormInput
): Promise<ActionResult<void>> {
  const parsed = accueilFormSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));
  const intake = parsed.data; // cguAccepted is validated above, not persisted

  try {
    const patient = await prisma.patient.findUnique({
      where: { inviteToken: token },
      select: {
        id: true,
        kineId: true,
        isAnonymized: true,
        inviteExpiresAt: true,
        inviteCompletedAt: true,
      },
    });

    if (!patient) return fail("Lien invalide.");
    if (patient.isAnonymized) return fail("Ce dossier n'est plus disponible.");
    if (patient.inviteCompletedAt) return fail("Ce formulaire a déjà été complété.");
    if (patient.inviteExpiresAt && patient.inviteExpiresAt < new Date()) {
      return fail("Ce lien a expiré.");
    }

    const intakeData = {
      heightCm: intake.heightCm,
      weightKg: intake.weightKg,
      bikeType: intake.bikeType,
      ridingLevel: intake.ridingLevel,
      weeklyHours: intake.weeklyHours,
      yearsRiding: intake.yearsRiding,
      injuries: intake.injuries,
      goals: intake.goals,
      medicalNotes: intake.medicalNotes,
      source: "custom_form",
    };

    // Save the intake, record the RGPD consent on the patient, and invalidate
    // the link — all atomically.
    await prisma.$transaction([
      prisma.patientIntake.upsert({
        where: { patientId: patient.id },
        create: { patientId: patient.id, ...intakeData },
        update: intakeData,
      }),
      prisma.patient.update({
        where: { id: patient.id },
        data: {
          inviteCompletedAt: new Date(),
          consentAcceptedAt: new Date(),
          consentVersion: INTAKE_CGU_VERSION,
        },
      }),
    ]);

    // Attribute the audit entry to the patient's kiné (no actor session here).
    await logAudit({
      userId: patient.kineId,
      action: "CREATE",
      entity: "intake",
      entityId: patient.id,
      metadata: { source: "custom_form", consentVersion: INTAKE_CGU_VERSION },
    });

    return ok(undefined);
  } catch (e) {
    console.error("submitAccueilForm failed:", e);
    return fail("Impossible d'enregistrer le formulaire. Réessayez.");
  }
}
