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
