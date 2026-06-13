"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { manualIntakeSchema } from "@/lib/validations/intake.schema";
import { logAudit } from "@/lib/audit";
import { requireKine } from "@/lib/auth";
import { appBaseUrl } from "@/lib/app-url";
import { sendIntakeInviteEmail } from "@/lib/intake-email";
import { inviteExpiryFromNow } from "@/lib/legal";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { z } from "zod";

type ManualIntakeInput = z.infer<typeof manualIntakeSchema>;

/**
 * Saves intake data entered manually by the kiné. The intake is the
 * patient-level information collected once; the lifecycle now lives on each
 * study, so saving the intake no longer touches any patient status.
 */
export async function saveIntake(
  patientId: string,
  data: ManualIntakeInput
): Promise<ActionResult<{ patientId: string }>> {
  const parsed = manualIntakeSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));
  const intake = parsed.data;

  try {
    const kine = await requireKine();

    // Scope check: KINE can only touch their own patients.
    const patient = await prisma.patient.findUnique({
      where: {
        id: patientId,
        ...(kine.role !== "ADMIN" && { kineId: kine.id }),
      },
      select: { id: true },
    });
    if (!patient) return fail("Patient introuvable.");

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
      source: "manual",
    };

    await prisma.patientIntake.upsert({
      where: { patientId },
      create: { patientId, ...intakeData },
      update: intakeData,
    });

    await logAudit({
      userId: kine.id,
      action: "UPDATE",
      entity: "intake",
      entityId: patientId,
      metadata: { source: "manual" },
    });

    revalidatePath(`/patients/${patientId}`);
    return ok({ patientId });
  } catch (e) {
    console.error("saveIntake failed:", e);
    return fail("Impossible d'enregistrer l'intake. Réessayez.");
  }
}

/**
 * Sends (or re-sends) the "formulaire d'accueil" invitation email to a patient.
 * Ensures the patient has a valid invite token, refreshes its 30-day expiry,
 * then delivers the link via Resend. Used by the manual BO button now and by
 * the Calendly webhook automation later.
 */
export async function sendIntakeEmail(
  patientId: string
): Promise<ActionResult<void>> {
  try {
    const kine = await requireKine();

    // Scope check: KINE can only act on their own patients.
    const patient = await prisma.patient.findUnique({
      where: {
        id: patientId,
        ...(kine.role !== "ADMIN" && { kineId: kine.id }),
      },
      select: {
        id: true,
        firstName: true,
        email: true,
        isAnonymized: true,
        inviteToken: true,
        inviteCompletedAt: true,
      },
    });
    if (!patient) return fail("Patient introuvable.");
    if (patient.isAnonymized) return fail("Patient anonymisé — envoi impossible.");
    if (patient.inviteCompletedAt) {
      return fail("Le formulaire d'accueil a déjà été complété.");
    }

    // Ensure a token exists, and (re)set a fresh 30-day expiry on each send.
    const token = patient.inviteToken ?? randomUUID();
    await prisma.patient.update({
      where: { id: patient.id },
      data: {
        inviteToken: token,
        inviteExpiresAt: inviteExpiryFromNow(),
        inviteSentAt: new Date(),
      },
    });

    const formUrl = `${await appBaseUrl()}/accueil/${token}`;
    const sent = await sendIntakeInviteEmail({
      to: patient.email,
      firstName: patient.firstName,
      formUrl,
    });
    if (!sent.ok) return fail(sent.error);

    await logAudit({
      userId: kine.id,
      action: "UPDATE",
      entity: "intake",
      entityId: patient.id,
      metadata: { action: "send_email", emailed: sent.emailed },
    });

    revalidatePath(`/patients/${patientId}`);
    return ok(undefined);
  } catch (e) {
    console.error("sendIntakeEmail failed:", e);
    return fail("Impossible d'envoyer le formulaire d'accueil. Réessayez.");
  }
}
