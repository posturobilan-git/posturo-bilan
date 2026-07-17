"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { studySchema } from "@/lib/validations/study.schema";
import { logAudit } from "@/lib/audit";
import { requireKine, requirePatientOwnership } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { deleteBlob } from "@/lib/storage";
import { Prisma, StudyStatus } from "@prisma/client";
import type { StudyListItem } from "@/types";
import type { ListResult, PageQuery } from "@/lib/pagination";
import { decryptFields } from "@/lib/crypto";
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

/** Nested-create rows for a study's structured pains, ordered by array position. */
function painsCreateData(pains: StudyInput["pains"]) {
  return pains.map((p, i) => ({
    location: p.location,
    type: p.type ?? null,
    intensity: p.intensity ?? null,
    restAtRest: p.restAtRest,
    activity: p.activity ?? null,
    duration: p.duration ?? null,
    aggravatingFactors: p.aggravatingFactors ?? null,
    relievingFactors: p.relievingFactors ?? null,
    order: i,
  }));
}

/**
 * Nested-create rows for a study's patient photos (prompt 25), ordered by array
 * position within each phase so the before[i]/after[i] pairs line up in the bilan.
 */
function photosCreateData(photos: StudyInput["photos"]) {
  const next: Record<string, number> = { BEFORE: 0, AFTER: 0 };
  return photos.map((p) => ({
    url: p.url,
    phase: p.phase,
    angle: p.angle ?? null,
    caption: p.caption ?? null,
    order: next[p.phase]++,
  }));
}

/**
 * Blob keys of a study's current photos that are NOT in the incoming set — i.e.
 * photos the kiné removed. Their blobs must be deleted to avoid orphans (and for
 * RGPD hygiene). Computed before the wholesale row replace.
 */
async function removedPhotoKeys(studyId: string, keepUrls: string[]): Promise<string[]> {
  const existing = await prisma.studyPhoto.findMany({
    where: { studyId },
    select: { url: true },
  });
  const keep = new Set(keepUrls);
  return existing.filter((p) => !keep.has(p.url)).map((p) => p.url);
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

/**
 * Loads a study and asserts the acting kiné may mutate it (its owner, or any
 * ADMIN). Throws "Étude introuvable." / "Accès refusé à cette étude." which the
 * callers map to an ActionResult. Mirrors requirePatientOwnership / the report
 * authz guard so study writes can't cross tenants by passing a foreign id.
 */
async function assertStudyOwnership(studyId: string) {
  const kine = await requireKine();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, kineId: true },
  });
  if (!study) throw new Error("Étude introuvable.");
  if (kine.role !== "ADMIN" && study.kineId !== kine.id) {
    throw new Error("Accès refusé à cette étude.");
  }
  return { kine, study };
}

/**
 * Authoritative required-field guard for finalising a study. Every active côte /
 * test marked `isRequired` and applicable to the chosen bike type must hold at
 * least a "before" value (côtes) / a result (tests). Returns the missing names.
 */
async function missingRequiredFields(validated: StudyInput): Promise<string[]> {
  const { bikeTypeId } = validated;
  const [reqMeasurements, reqRiderMeasurements, reqTests] = await Promise.all([
    prisma.measurement.findMany({
      where: {
        isActive: true,
        isRequired: true,
        OR: [{ isCommon: true }, { bikeTypeLinks: { some: { bikeTypeId } } }],
      },
      select: { id: true, name: true },
    }),
    prisma.riderMeasurement.findMany({
      where: {
        isActive: true,
        isRequired: true,
        OR: [{ isCommon: true }, { bikeTypeLinks: { some: { bikeTypeId } } }],
      },
      select: { id: true, name: true },
    }),
    prisma.physioTest.findMany({
      where: {
        isActive: true,
        isRequired: true,
        OR: [{ isCommon: true }, { bikeTypeLinks: { some: { bikeTypeId } } }],
      },
      select: { id: true, name: true },
    }),
  ]);

  const beforeById = new Map(validated.measureValues.map((v) => [v.measurementId, v.before]));
  const riderBeforeById = new Map(
    validated.riderMeasureValues.map((v) => [v.riderMeasurementId, v.before])
  );
  const resultById = new Map(validated.physioResults.map((r) => [r.physioTestId, r.value]));
  const hasValue = (v: unknown) => v !== null && v !== undefined && v !== "";

  const missing: string[] = [];
  for (const m of reqMeasurements) {
    if (beforeById.get(m.id) == null) missing.push(m.name);
  }
  for (const m of reqRiderMeasurements) {
    if (riderBeforeById.get(m.id) == null) missing.push(m.name);
  }
  for (const t of reqTests) {
    if (!hasValue(resultById.get(t.id))) missing.push(t.name);
  }
  return missing;
}

/** Thrown auth/ownership messages worth surfacing to the caller verbatim. */
function isAuthzError(e: unknown): e is Error {
  return (
    e instanceof Error &&
    (e.message.startsWith("Accès refusé") ||
      e.message === "Patient introuvable." ||
      e.message === "Étude introuvable." ||
      e.message === "Non authentifié" ||
      e.message === "Compte en attente de validation")
  );
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

/** Shared write payload for a study's côtes, tests physio + observations. */
function studyDataFrom(validated: StudyInput) {
  return {
    bikeTypeId: validated.bikeTypeId,
    measureValues: validated.measureValues as Prisma.InputJsonValue,
    riderMeasureValues: validated.riderMeasureValues as Prisma.InputJsonValue,
    physioResults: validated.physioResults as Prisma.InputJsonValue,
    observations: validated.observations ?? null,
    summary: validated.summary ?? null,
    recommendations: validated.recommendations ?? null,
  };
}

/**
 * All studies across patients, scoped to the kiné (ADMIN sees everything).
 * patient.firstName/lastName sont chiffrés — recherche et tri par patient se
 * font en mémoire après déchiffrement, comme dans getPatients.
 */
export async function getStudies(filters?: {
  status?: StudyStatus;
  search?: string;
  page?: PageQuery;
}): Promise<ListResult<StudyListItem>> {
  const kine = await requireKine();

  const where: Prisma.StudyWhereInput = {
    ...(kine.role !== "ADMIN" && { kineId: kine.id }),
    ...(filters?.status && { status: filters.status }),
  };

  const raw = await prisma.study.findMany({
    where,
    include: {
      bikeType: true,
      patient: { select: { id: true, firstName: true, lastName: true, isAnonymized: true } },
      kine: { select: { name: true } },
    },
  });

  let items: StudyListItem[] = raw.map((s) => ({
    ...s,
    patient: decryptFields(s.patient, ["firstName", "lastName"] as const),
    kine: decryptFields(s.kine, ["name"] as const),
  }));

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    items = items.filter(
      (s) =>
        s.patient.firstName.toLowerCase().includes(q) ||
        s.patient.lastName.toLowerCase().includes(q)
    );
  }

  const total = items.length;

  const page = filters?.page;
  const dir = page?.dir === "asc" ? 1 : -1;
  items = items.sort((a, b) => {
    if (page?.sort === "patient") {
      const an = `${a.patient.lastName} ${a.patient.firstName}`.toLowerCase();
      const bn = `${b.patient.lastName} ${b.patient.firstName}`.toLowerCase();
      return an < bn ? -dir : an > bn ? dir : 0;
    }
    if (page?.sort === "status") {
      return a.status < b.status ? -dir : a.status > b.status ? dir : 0;
    }
    return a.createdAt < b.createdAt ? -dir : a.createdAt > b.createdAt ? dir : 0;
  });

  if (page) {
    const start = (page.page - 1) * page.perPage;
    items = items.slice(start, start + page.perPage);
  }

  return { items, total };
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
    if (validated.draftStudyId) {
      // Authorize before mutating: a KINE may only edit their own studies.
      await assertStudyOwnership(validated.draftStudyId);
      // Photos the kiné dropped (compared to what's stored) → delete their blobs.
      const removed = await removedPhotoKeys(
        validated.draftStudyId,
        validated.photos.map((p) => p.url)
      );
      // Editing an existing study invalidates any previously generated report.
      await prisma.study.update({
        where: { id: validated.draftStudyId },
        data: {
          ...studyDataFrom(validated),
          ...buildRelations(validated.componentIds, validated.exerciseIds),
          // Replace the structured pains wholesale (the form sends the full set).
          pains: { deleteMany: {}, create: painsCreateData(validated.pains) },
          // Same wholesale replace for photos (rows only — blobs handled above/below).
          photos: { deleteMany: {}, create: photosCreateData(validated.photos) },
          reportUrl: null,
          reportSentAt: null,
        },
      });
      await Promise.all(removed.map(deleteBlob));
      await revertReportStatus(validated.draftStudyId);
      return ok({ studyId: validated.draftStudyId });
    }

    // Creating a study: the target patient must belong to the acting kiné.
    const { user: kine } = await requirePatientOwnership(validated.patientId);
    const study = await prisma.study.create({
      data: {
        patientId: validated.patientId,
        kineId: kine.id,
        ...studyDataFrom(validated),
        photos: { create: photosCreateData(validated.photos) },
        componentsUsed: { connect: validated.componentIds.map((id) => ({ id })) },
        exercisesPrescribed: { connect: validated.exerciseIds.map((id) => ({ id })) },
      },
    });

    await logAudit({ userId: kine.id, action: "CREATE", entity: "study", entityId: study.id });
    return ok({ studyId: study.id });
  } catch (e) {
    if (isAuthzError(e)) return fail(e.message);
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
    // Block finalisation when a required côte/test applicable to the bike type
    // is still empty (drafts may stay partial; submitted studies may not).
    const missing = await missingRequiredFields(validated);
    if (missing.length > 0) {
      return fail(`Champs obligatoires manquants : ${missing.join(", ")}.`);
    }

    let studyId: string;
    let kineId: string;

    if (validated.draftStudyId) {
      // Authorize before mutating: a KINE may only edit their own studies.
      const { kine } = await assertStudyOwnership(validated.draftStudyId);
      kineId = kine.id;
      // Photos the kiné dropped (compared to what's stored) → delete their blobs.
      const removed = await removedPhotoKeys(
        validated.draftStudyId,
        validated.photos.map((p) => p.url)
      );
      // Editing an existing study invalidates any previously generated report.
      await prisma.study.update({
        where: { id: validated.draftStudyId },
        data: {
          ...studyDataFrom(validated),
          ...buildRelations(validated.componentIds, validated.exerciseIds),
          // Replace the structured pains wholesale (the form sends the full set).
          pains: { deleteMany: {}, create: painsCreateData(validated.pains) },
          // Same wholesale replace for photos (rows only — blobs handled above/below).
          photos: { deleteMany: {}, create: photosCreateData(validated.photos) },
          reportUrl: null,
          reportSentAt: null,
        },
      });
      await Promise.all(removed.map(deleteBlob));
      studyId = validated.draftStudyId;
    } else {
      // Creating a study: the target patient must belong to the acting kiné.
      const { user: kine } = await requirePatientOwnership(validated.patientId);
      kineId = kine.id;
      const study = await prisma.study.create({
        data: {
          patientId: validated.patientId,
          kineId: kine.id,
          ...studyDataFrom(validated),
          pains: { create: painsCreateData(validated.pains) },
          photos: { create: photosCreateData(validated.photos) },
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
      userId: kineId,
      action: "UPDATE",
      entity: "study",
      entityId: studyId,
      metadata: { submitted: true },
    });

    revalidatePath(`/dashboard/patients/${validated.patientId}`);
    revalidatePath("/dashboard/etudes");
    return ok({ studyId });
  } catch (e) {
    if (isAuthzError(e)) return fail(e.message);
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
      select: { id: true, kineId: true, patientId: true, reportUrl: true, photos: { select: { url: true } } },
    });
    if (!study) return fail("Étude introuvable.");
    if (kine.role !== "ADMIN" && study.kineId !== kine.id) {
      return fail("Accès refusé à cette étude.");
    }

    // StudyPhoto rows cascade with the study; their blobs must be removed too.
    await prisma.study.delete({ where: { id: studyId } });
    if (study.reportUrl) await deleteBlob(study.reportUrl);
    await Promise.all(study.photos.map((p) => deleteBlob(p.url)));

    await logAudit({ userId: kine.id, action: "DELETE", entity: "study", entityId: studyId });
    revalidatePath(`/dashboard/patients/${study.patientId}`);
    revalidatePath("/dashboard/etudes");
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
  revalidatePath(`/dashboard/patients/${current.patientId}`);
  revalidatePath("/dashboard/etudes");
  return study;
}
