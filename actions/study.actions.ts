"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { studySchema } from "@/lib/validations/study.schema";
import { logAudit } from "@/lib/audit";
import { requireKine } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import type { Prisma, PatientStatus } from "@prisma/client";
import { z } from "zod";

type StudyInput = z.infer<typeof studySchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRelations(componentIds: string[], exerciseIds: string[]) {
  return {
    componentsUsed: { set: componentIds.map((id) => ({ id })) },
    exercisesPrescribed: { set: exerciseIds.map((id) => ({ id })) },
  };
}

// Statuses that should move forward to study_completed when a study is
// finalised. report_sent is included so that re-submitting an edited study
// (whose report was just invalidated) drops back to study_completed.
const NEEDS_ADVANCE: PatientStatus[] = [
  "intake_pending",
  "intake_completed",
  "study_pending",
  "report_sent",
];

/**
 * When an already-reported study is edited, the sent report is stale, so the
 * patient drops back from report_sent to study_completed. No-op otherwise.
 */
async function revertReportStatus(patientId: string) {
  await prisma.patient.updateMany({
    where: { id: patientId, status: "report_sent" },
    data: { status: "study_completed" },
  });
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getStudy(id: string) {
  const kine = await requireKine();

  return prisma.postureStudy.findUnique({
    where: {
      id,
      ...(kine.role !== "ADMIN" && { kineId: kine.id }),
    },
    include: { componentsUsed: true, exercisesPrescribed: true },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Saves progress without advancing patient status.
 * Creates a new PostureStudy if no draftStudyId, otherwise updates.
 */
export async function saveDraftStudy(
  data: StudyInput
): Promise<ActionResult<{ studyId: string }>> {
  const parsed = studySchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));
  const validated = parsed.data;

  try {
    const kine = await requireKine();

    if (validated.draftStudyId) {
      // Editing an existing study invalidates any previously generated report.
      await prisma.postureStudy.update({
        where: { id: validated.draftStudyId },
        data: {
          measures: validated.measures as Prisma.InputJsonValue,
          ...buildRelations(validated.componentIds, validated.exerciseIds),
          reportUrl: null,
          reportSentAt: null,
        },
      });
      await revertReportStatus(validated.patientId);
      return ok({ studyId: validated.draftStudyId });
    }

    const study = await prisma.postureStudy.create({
      data: {
        patientId: validated.patientId,
        kineId: kine.id,
        measures: validated.measures as Prisma.InputJsonValue,
        componentsUsed: { connect: validated.componentIds.map((id) => ({ id })) },
        exercisesPrescribed: { connect: validated.exerciseIds.map((id) => ({ id })) },
      },
    });

    await logAudit({ userId: kine.id, action: "CREATE", entity: "study", entityId: study.id });
    return ok({ studyId: study.id });
  } catch (e) {
    console.error("saveDraftStudy failed:", e);
    return fail("Impossible d'enregistrer le brouillon. Réessayez.");
  }
}

/**
 * Finalises the study and advances patient status to study_completed
 * (only if the patient hasn't already moved past that stage).
 */
export async function submitStudy(
  data: StudyInput
): Promise<ActionResult<{ studyId: string }>> {
  const parsed = studySchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));
  const validated = parsed.data;

  // Require at least the core measures before finalising.
  if (validated.measures.saddleHeight == null || validated.measures.saddleSetback == null) {
    return fail("Hauteur et recul de selle sont requis pour soumettre l'étude.");
  }

  try {
    const kine = await requireKine();
    let studyId: string;

    if (validated.draftStudyId) {
      // Editing an existing study invalidates any previously generated report.
      await prisma.postureStudy.update({
        where: { id: validated.draftStudyId },
        data: {
          measures: validated.measures as Prisma.InputJsonValue,
          ...buildRelations(validated.componentIds, validated.exerciseIds),
          reportUrl: null,
          reportSentAt: null,
        },
      });
      studyId = validated.draftStudyId;
    } else {
      const study = await prisma.postureStudy.create({
        data: {
          patientId: validated.patientId,
          kineId: kine.id,
          measures: validated.measures as Prisma.InputJsonValue,
          componentsUsed: { connect: validated.componentIds.map((id) => ({ id })) },
          exercisesPrescribed: { connect: validated.exerciseIds.map((id) => ({ id })) },
        },
      });
      studyId = study.id;
    }

    // Advance status only if the patient is still at/before study stage.
    const current = await prisma.patient.findUnique({
      where: { id: validated.patientId },
      select: { status: true },
    });
    if (current && NEEDS_ADVANCE.includes(current.status)) {
      await prisma.patient.update({
        where: { id: validated.patientId },
        data: { status: "study_completed" },
      });
    }

    await logAudit({
      userId: kine.id,
      action: "UPDATE",
      entity: "study",
      entityId: studyId,
      metadata: { submitted: true, fromStatus: current?.status },
    });

    revalidatePath(`/patients/${validated.patientId}`);
    return ok({ studyId });
  } catch (e) {
    console.error("submitStudy failed:", e);
    return fail("Impossible de soumettre l'étude. Réessayez.");
  }
}
