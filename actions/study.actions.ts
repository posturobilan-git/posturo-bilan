"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { studySchema } from "@/lib/validations/study.schema";
import { logAudit } from "@/lib/audit";
import { requireKine } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { deleteReport } from "@/lib/storage";
import { Prisma, StudyStatus } from "@prisma/client";
import type { StudyListItem } from "@/types";
import { z } from "zod";

type StudyInput = z.infer<typeof studySchema>;

// ─── State machine (now per-study) ──────────────────────────────────────────────

const VALID_TRANSITIONS: Record<StudyStatus, StudyStatus | null> = {
  study_pending: "study_completed",
  study_completed: "report_sent",
  report_sent: "followup_pending",
  followup_pending: "followup_completed",
  followup_completed: null,
};

// Statuses that should move forward to study_completed when a study is finalised.
// report_sent is included so that re-submitting an edited study (whose report
// was just invalidated) drops back to study_completed.
const ADVANCE_ON_SUBMIT: StudyStatus[] = ["study_pending", "report_sent"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRelations(componentIds: string[], exerciseIds: string[]) {
  return {
    componentsUsed: { set: componentIds.map((id) => ({ id })) },
    exercisesPrescribed: { set: exerciseIds.map((id) => ({ id })) },
  };
}

/**
 * When an already-reported study is edited, the sent report is stale, so the
 * study drops back from report_sent to study_completed. No-op otherwise.
 */
async function revertReportStatus(studyId: string) {
  await prisma.study.updateMany({
    where: { id: studyId, status: "report_sent" },
    data: { status: "study_completed" },
  });
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getStudy(id: string) {
  const kine = await requireKine();

  return prisma.study.findUnique({
    where: {
      id,
      ...(kine.role !== "ADMIN" && { kineId: kine.id }),
    },
    include: { bikeType: true, componentsUsed: true, exercisesPrescribed: true },
  });
}

/** Shared write payload for a study's côtes + free-text observations. */
function studyDataFrom(validated: StudyInput) {
  return {
    bikeTypeId: validated.bikeTypeId,
    measureValues: validated.measureValues as Prisma.InputJsonValue,
    observations: validated.observations ?? null,
  };
}

/** All studies across patients, scoped to the kiné (ADMIN sees everything). */
export async function getStudies(filters?: {
  status?: StudyStatus;
}): Promise<StudyListItem[]> {
  const kine = await requireKine();

  return prisma.study.findMany({
    where: {
      ...(kine.role !== "ADMIN" && { kineId: kine.id }),
      ...(filters?.status && { status: filters.status }),
    },
    include: {
      bikeType: true,
      patient: { select: { id: true, firstName: true, lastName: true, isAnonymized: true } },
      kine: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Saves progress without finalising the study.
 * Creates a new Study (status study_pending) if no draftStudyId, otherwise updates.
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
      await prisma.study.update({
        where: { id: validated.draftStudyId },
        data: {
          ...studyDataFrom(validated),
          ...buildRelations(validated.componentIds, validated.exerciseIds),
          reportUrl: null,
          reportSentAt: null,
        },
      });
      await revertReportStatus(validated.draftStudyId);
      return ok({ studyId: validated.draftStudyId });
    }

    const study = await prisma.study.create({
      data: {
        patientId: validated.patientId,
        kineId: kine.id,
        ...studyDataFrom(validated),
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
 * Finalises the study and advances its status to study_completed
 * (only if it hasn't already moved past that stage).
 */
export async function submitStudy(
  data: StudyInput
): Promise<ActionResult<{ studyId: string }>> {
  const parsed = studySchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));
  const validated = parsed.data;

  try {
    const kine = await requireKine();
    let studyId: string;

    if (validated.draftStudyId) {
      // Editing an existing study invalidates any previously generated report.
      await prisma.study.update({
        where: { id: validated.draftStudyId },
        data: {
          ...studyDataFrom(validated),
          ...buildRelations(validated.componentIds, validated.exerciseIds),
          reportUrl: null,
          reportSentAt: null,
        },
      });
      studyId = validated.draftStudyId;
    } else {
      const study = await prisma.study.create({
        data: {
          patientId: validated.patientId,
          kineId: kine.id,
          ...studyDataFrom(validated),
          componentsUsed: { connect: validated.componentIds.map((id) => ({ id })) },
          exercisesPrescribed: { connect: validated.exerciseIds.map((id) => ({ id })) },
        },
      });
      studyId = study.id;
    }

    // Advance the study to study_completed only if it's still at/before that stage.
    await prisma.study.updateMany({
      where: { id: studyId, status: { in: ADVANCE_ON_SUBMIT } },
      data: { status: "study_completed" },
    });

    await logAudit({
      userId: kine.id,
      action: "UPDATE",
      entity: "study",
      entityId: studyId,
      metadata: { submitted: true },
    });

    revalidatePath(`/patients/${validated.patientId}`);
    revalidatePath("/etudes");
    return ok({ studyId });
  } catch (e) {
    console.error("submitStudy failed:", e);
    return fail("Impossible de soumettre l'étude. Réessayez.");
  }
}

/**
 * Deletes a study. Its component/exercise links drop via the implicit-relation
 * cascade; the patient and any follow-ups (patient-level) are untouched. The
 * stored report PDF is cleaned up best-effort.
 */
export async function deleteStudy(studyId: string): Promise<ActionResult<void>> {
  try {
    const kine = await requireKine();

    const study = await prisma.study.findUnique({
      where: { id: studyId },
      select: { id: true, kineId: true, patientId: true, reportUrl: true },
    });
    if (!study) return fail("Étude introuvable.");
    if (kine.role !== "ADMIN" && study.kineId !== kine.id) {
      return fail("Accès refusé à cette étude.");
    }

    await prisma.study.delete({ where: { id: studyId } });
    if (study.reportUrl) await deleteReport(study.reportUrl);

    await logAudit({ userId: kine.id, action: "DELETE", entity: "study", entityId: studyId });
    revalidatePath(`/patients/${study.patientId}`);
    revalidatePath("/etudes");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Accès refusé")) return fail(e.message);
    console.error("deleteStudy failed:", e);
    return fail("Impossible de supprimer l'étude. Réessayez.");
  }
}

/**
 * Canonical state-machine transition for a study status. Enforces strict
 * sequential transitions (study_pending → … → followup_completed).
 */
export async function updateStudyStatus(studyId: string, newStatus: StudyStatus) {
  const kine = await requireKine();

  const current = await prisma.study.findUnique({
    where: {
      id: studyId,
      ...(kine.role !== "ADMIN" && { kineId: kine.id }),
    },
    select: { status: true, patientId: true },
  });

  if (!current) throw new Error("Étude introuvable");

  const allowed = VALID_TRANSITIONS[current.status];
  if (allowed !== newStatus) {
    throw new Error(
      `Transition invalide : ${current.status} → ${newStatus}. Attendu : ${allowed ?? "aucun"}`
    );
  }

  const study = await prisma.study.update({
    where: { id: studyId },
    data: { status: newStatus },
  });

  await logAudit({
    userId: kine.id,
    action: "UPDATE",
    entity: "study",
    entityId: studyId,
    metadata: { from: current.status, to: newStatus },
  });
  revalidatePath(`/patients/${current.patientId}`);
  revalidatePath("/etudes");
  return study;
}
