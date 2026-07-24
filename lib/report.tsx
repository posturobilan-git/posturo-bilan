import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { getResend, resendFrom } from "@/lib/email";
import { storePdf, readBlob } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { ReportTemplate, type ReportMeasureRow, type ReportPhysioRow, type ReportPhoto, type ReportPhotoPair } from "@/components/pdf/ReportTemplate";
import { ReportEmail } from "@/lib/emails/ReportEmail";
import { isLocalEnv } from "@/lib/env";
import { PHOTO_ANGLE_LABELS } from "@/lib/labels";
import { pairByAngle } from "@/lib/photos";
import { formatPhysioValue, hasPhysioValue, type StudyPhysioResult } from "@/lib/physio";
import type { StudyForReport, StudyMeasureValue, StudyRiderMeasureValue } from "@/types";
import type { PhotoPhase, PhotoAngle } from "@prisma/client";
import { decryptFields } from "@/lib/crypto";
import { PATIENT_ENCRYPTED_FIELDS, INTAKE_ENCRYPTED_FIELDS, USER_ENCRYPTED_FIELDS } from "@/lib/crypto.constants";

const CABINET = process.env.CABINET_NAME || "Posturo Vélo";
const FROM = resendFrom();

function buildAdjustments(study: StudyForReport): string[] {
  return study.componentsUsed.map((c) =>
    [c.category.name, c.name, c.brand].filter(Boolean).join(" — ")
  );
}

async function fetchStudyForReport(studyId: string): Promise<StudyForReport | null> {
  const study = (await prisma.study.findUnique({
    where: { id: studyId },
    include: {
      bikeType: true,
      componentsUsed: { include: { category: { select: { name: true } } } },
      exercisesPrescribed: true,
      pains: { orderBy: { order: "asc" } },
      kine: true,
      patient: { include: { intake: true } },
    },
  })) as StudyForReport | null;
  if (!study) return null;

  return {
    ...study,
    kine: decryptFields(study.kine, USER_ENCRYPTED_FIELDS),
    patient: {
      ...decryptFields(study.patient, PATIENT_ENCRYPTED_FIELDS),
      intake: study.patient.intake
        ? decryptFields(study.patient.intake, INTAKE_ENCRYPTED_FIELDS)
        : null,
    },
  };
}

/** Resolves a study's stored côte values into labelled before/after rows. */
async function buildMeasureRows(study: StudyForReport): Promise<ReportMeasureRow[]> {
  const values = (study.measureValues as StudyMeasureValue[] | null) ?? [];
  if (values.length === 0) return [];

  const measurements = await prisma.measurement.findMany({
    where: { id: { in: values.map((v) => v.measurementId) } },
    select: { id: true, name: true, unit: true },
  });
  const byId = new Map(measurements.map((m) => [m.id, m]));

  return values
    .map((v) => ({ v, m: byId.get(v.measurementId) }))
    .filter((r): r is { v: StudyMeasureValue; m: (typeof measurements)[number] } => Boolean(r.m))
    .sort((a, b) => a.m.name.localeCompare(b.m.name))
    .map(({ v, m }) => ({ name: m.name, unit: m.unit, before: v.before ?? null, after: v.after ?? null }));
}

/** Resolves a study's stored mesures du cycliste into labelled before/after rows. */
async function buildRiderMeasureRows(study: StudyForReport): Promise<ReportMeasureRow[]> {
  const values = (study.riderMeasureValues as StudyRiderMeasureValue[] | null) ?? [];
  if (values.length === 0) return [];

  const measurements = await prisma.riderMeasurement.findMany({
    where: { id: { in: values.map((v) => v.riderMeasurementId) } },
    select: { id: true, name: true, unit: true },
  });
  const byId = new Map(measurements.map((m) => [m.id, m]));

  return values
    .map((v) => ({ v, m: byId.get(v.riderMeasurementId) }))
    .filter((r): r is { v: StudyRiderMeasureValue; m: (typeof measurements)[number] } => Boolean(r.m))
    .sort((a, b) => a.m.name.localeCompare(b.m.name))
    .map(({ v, m }) => ({ name: m.name, unit: m.unit, before: v.before ?? null, after: v.after ?? null }));
}

/** Resolves a study's stored physio results into pre-formatted rows. */
async function buildPhysioRows(study: StudyForReport): Promise<ReportPhysioRow[]> {
  // Keep results that carry a value OR a free-text comment (both go in the report).
  const results = ((study.physioResults as StudyPhysioResult[] | null) ?? []).filter(
    (r) => hasPhysioValue(r) || Boolean(r.comment?.trim())
  );
  if (results.length === 0) return [];

  const tests = await prisma.physioTest.findMany({
    where: { id: { in: results.map((r) => r.physioTestId) } },
    select: { id: true, name: true, unit: true, outputType: true },
  });
  const byId = new Map(tests.map((t) => [t.id, t]));

  return results
    .map((r) => ({ r, t: byId.get(r.physioTestId) }))
    .filter((x): x is { r: StudyPhysioResult; t: (typeof tests)[number] } => Boolean(x.t))
    .sort((a, b) => a.t.name.localeCompare(b.t.name))
    .map(({ r, t }) => ({
      name: t.name,
      value: hasPhysioValue(r) ? formatPhysioValue(t.outputType, r.value ?? null, t.unit) : "—",
      comment: r.comment?.trim() || null,
    }));
}

/**
 * Reads the study's patient photos from the private Blob store and turns them
 * into base64 data URIs (prompt 25), split into before/after for the bilan
 * comparison. Skips formats @react-pdf can't embed (only JPEG/PNG) and any blob
 * that can't be read, so a missing photo never breaks report generation.
 */
async function buildPhotoData(studyId: string): Promise<ReportPhotoPair[]> {
  const photos = await prisma.studyPhoto.findMany({
    where: { studyId },
    orderBy: [{ phase: "asc" }, { order: "asc" }],
  });

  type Loaded = { phase: PhotoPhase; angle: PhotoAngle | null; photo: ReportPhoto };
  const loaded = (
    await Promise.all(
      photos.map(async (p): Promise<Loaded | null> => {
        const ext = p.url.split(".").pop()?.toLowerCase();
        if (ext !== "jpg" && ext !== "jpeg" && ext !== "png") return null;
        const blob = await readBlob(p.url);
        if (!blob) return null;
        return {
          phase: p.phase,
          angle: p.angle,
          photo: {
            dataUri: `data:${blob.contentType};base64,${blob.buffer.toString("base64")}`,
            angle: p.angle ? PHOTO_ANGLE_LABELS[p.angle] : null,
            caption: p.caption,
          },
        };
      })
    )
  ).filter((x): x is Loaded => x !== null);

  // Pair so the same angle is side by side (prompt 25), then drop the raw angle.
  return pairByAngle(
    loaded.filter((x) => x.phase === "BEFORE"),
    loaded.filter((x) => x.phase === "AFTER")
  ).map((pair) => ({ before: pair.before?.photo, after: pair.after?.photo }));
}

// ─── Generate ─────────────────────────────────────────────────────────────────

/**
 * Renders the PDF and stores it (Vercel Blob in deployment, local FS in dev).
 * Sets `reportUrl` so it can be previewed/downloaded. Does NOT email the
 * patient and does NOT change the patient status.
 */
export async function generateReportForStudy(
  studyId: string,
  actorId: string
): Promise<ActionResult<{ reportUrl: string }>> {
  // Deployments must use durable Blob storage; local may use the filesystem.
  if (!isLocalEnv() && !process.env.BLOB_READ_WRITE_TOKEN) {
    return fail("Stockage des fichiers non configuré (BLOB_READ_WRITE_TOKEN manquant).");
  }

  const study = await fetchStudyForReport(studyId);
  if (!study) return fail("Étude introuvable.");
  if (study.patient.isAnonymized) {
    return fail("Patient anonymisé — génération du rapport impossible.");
  }

  try {
    const [measureRows, riderMeasureRows, physioRows, photoData] = await Promise.all([
      buildMeasureRows(study),
      buildRiderMeasureRows(study),
      buildPhysioRows(study),
      buildPhotoData(study.id),
    ]);
    const pdfBuffer = await renderToBuffer(
      <ReportTemplate
        study={study}
        measureRows={measureRows}
        riderMeasureRows={riderMeasureRows}
        physioRows={physioRows}
        photoPairs={photoData}
      />
    );
    const url = await storePdf(`reports/${studyId}.pdf`, pdfBuffer);

    await prisma.study.update({
      where: { id: studyId },
      data: { reportUrl: url },
    });

    await logAudit({
      userId: actorId,
      action: "UPDATE",
      entity: "report",
      entityId: studyId,
      metadata: { action: "generate", reportUrl: url },
    });

    return ok({ reportUrl: url });
  } catch (e) {
    console.error("generateReportForStudy failed:", e);
    return fail("Échec de la génération du rapport.");
  }
}

// ─── Send ─────────────────────────────────────────────────────────────────────

/**
 * Emails the (already generated) report to the patient and advances the
 * study to report_sent. Requires the report to have been generated first.
 */
export async function sendReportForStudy(
  studyId: string,
  actorId: string
): Promise<ActionResult<{ reportUrl: string }>> {
  const local = isLocalEnv();
  const canEmail = Boolean(process.env.RESEND_API_KEY);

  // Deployments must be able to actually send the email.
  if (!local && !canEmail) {
    return fail("Envoi d'email non configuré (RESEND_API_KEY manquant).");
  }

  const study = await fetchStudyForReport(studyId);
  if (!study) return fail("Étude introuvable.");
  if (study.patient.isAnonymized) {
    return fail("Patient anonymisé — envoi du rapport impossible.");
  }
  if (!study.reportUrl) {
    return fail("Générez d'abord le rapport avant de l'envoyer.");
  }

  try {
    // Re-render for the email attachment (current data == generated data,
    // since editing the study resets the report).
    const [measureRows, riderMeasureRows, physioRows, photoData] = await Promise.all([
      buildMeasureRows(study),
      buildRiderMeasureRows(study),
      buildPhysioRows(study),
      buildPhotoData(study.id),
    ]);
    const pdfBuffer = await renderToBuffer(
      <ReportTemplate
        study={study}
        measureRows={measureRows}
        riderMeasureRows={riderMeasureRows}
        physioRows={physioRows}
        photoPairs={photoData}
      />
    );

    let emailed = false;
    if (canEmail) {
      const { error: emailError } = await getResend().emails.send({
        from: FROM,
        to: study.patient.email,
        subject: "Votre rapport d'étude posturale est disponible",
        react: ReportEmail({
          patientFirstName: study.patient.firstName,
          kineName: study.kine.name,
          exercises: study.exercisesPrescribed.map((e) => e.name),
          adjustments: buildAdjustments(study),
          cabinetName: CABINET,
        }),
        attachments: [
          { filename: "rapport-etude-posturale.pdf", content: pdfBuffer },
        ],
      });

      if (emailError) {
        console.error("Resend error:", emailError);
        return fail("L'email n'a pas pu être envoyé.");
      }
      emailed = true;
    } else {
      console.warn(`[report] Email skipped (RESEND_API_KEY unset). Report at ${study.reportUrl}`);
    }

    await prisma.study.update({
      where: { id: studyId },
      data: { reportSentAt: new Date() },
    });

    // Advance the study to report_sent (only from study_completed — never
    // downgrade a study already in the follow-up phase).
    await prisma.study.updateMany({
      where: { id: studyId, status: "study_completed" },
      data: { status: "report_sent" },
    });

    await logAudit({
      userId: actorId,
      action: "UPDATE",
      entity: "report",
      entityId: studyId,
      metadata: { action: "send", emailed },
    });

    return ok({ reportUrl: study.reportUrl });
  } catch (e) {
    console.error("sendReportForStudy failed:", e);
    return fail("Échec de l'envoi du rapport. Le statut n'a pas changé.");
  }
}

// ─── Combined ──────────────────────────────────────────────────────────────────

/** Generate then send in one call — see lib/emails `sendReportEmail`. */
export async function generateAndDeliverReport(
  studyId: string,
  actorId: string
): Promise<ActionResult<{ reportUrl: string }>> {
  const generated = await generateReportForStudy(studyId, actorId);
  if (!generated.ok) return generated;
  return sendReportForStudy(studyId, actorId);
}
