"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { manualIntakeSchema } from "@/lib/validations/intake.schema";
import { logAudit } from "@/lib/audit";
import { requireKine } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { z } from "zod";

type ManualIntakeInput = z.infer<typeof manualIntakeSchema>;

/**
 * Saves intake data entered manually by the kiné and advances the patient
 * from intake_pending to intake_completed (only on the first completion —
 * never downgrades a patient already further along the pipeline).
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
      select: { status: true },
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

    // Advance status only on first completion.
    if (patient.status === "intake_pending") {
      await prisma.patient.update({
        where: { id: patientId },
        data: { status: "intake_completed" },
      });
    }

    await logAudit({
      userId: kine.id,
      action: "UPDATE",
      entity: "intake",
      entityId: patientId,
      metadata: { source: "manual", advanced: patient.status === "intake_pending" },
    });

    revalidatePath(`/patients/${patientId}`);
    return ok({ patientId });
  } catch (e) {
    console.error("saveIntake failed:", e);
    return fail("Impossible d'enregistrer l'intake. Réessayez.");
  }
}
