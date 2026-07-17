"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { manualIntakeSchema } from "@/lib/validations/intake.schema";
import { logAudit } from "@/lib/audit";
import { requireKine } from "@/lib/auth";
import { sendIntakeEmail as sendIntakeEmailCore } from "@/lib/emails";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { encryptFields } from "@/lib/crypto";
import { INTAKE_ENCRYPTED_FIELDS } from "@/lib/crypto.constants";
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

    const intakeData = encryptFields(
      {
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
      },
      INTAKE_ENCRYPTED_FIELDS
    );

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

    revalidatePath(`/dashboard/patients/${patientId}`);
    return ok({ patientId });
  } catch (e) {
    console.error("saveIntake failed:", e);
    return fail("Impossible d'enregistrer l'intake. Réessayez.");
  }
}

/**
 * BO action: emails the patient their "formulaire d'accueil" link. Enforces
 * kiné ownership, then delegates the token handling, send and audit to the
 * consolidated email module (also used by the Cal.com webhook).
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
      select: { id: true },
    });
    if (!patient) return fail("Patient introuvable.");

    const result = await sendIntakeEmailCore(patientId);
    if (!result.ok) return result;

    revalidatePath(`/dashboard/patients/${patientId}`);
    return ok(undefined);
  } catch (e) {
    console.error("sendIntakeEmail failed:", e);
    return fail("Impossible d'envoyer le formulaire d'accueil. Réessayez.");
  }
}
