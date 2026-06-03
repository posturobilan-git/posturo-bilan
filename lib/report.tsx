import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { getResend } from "@/lib/email";
import { storePdf } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { ReportTemplate, type ReportMeasureRow } from "@/components/pdf/ReportTemplate";
import { ReportEmail } from "@/lib/emails/ReportEmail";
import { isLocalEnv } from "@/lib/env";
import type { StudyForReport, StudyMeasureValue } from "@/types";

const CABINET = process.env.CABINET_NAME || "PosturoBilan";
const FROM = process.env.RESEND_FROM_EMAIL || "PosturoBilan <onboarding@resend.dev>";

function buildAdjustments(study: StudyForReport): string[] {
  return study.componentsUsed.map((c) =>
    [c.category, c.name, c.brand].filter(Boolean).join(" — ")
  );
}

async function fetchStudyForReport(studyId: string): Promise<StudyForReport | null> {
  return (await prisma.study.findUnique({
    where: { id: studyId },
    include: {
      bikeType: true,
      componentsUsed: true,
      exercisesPrescribed: true,
      kine: true,
      patient: { include: { intake: true } },
    },
  })) as StudyForReport | null;
}

/** Resolves a study's stored côte values into labelled before/after rows. */
async function buildMeasureRows(study: StudyForReport): Promise<ReportMeasureRow[]> {
  const values = (study.measureValues as StudyMeasureValue[] | null) ?? [];
  if (values.length === 0) return [];

  const measurements = await prisma.measurement.findMany({
    where: { id: { in: values.map((v) => v.measurementId) } },
    select: { id: true, name: true, unit: true, order: true },
  });
  const byId = new Map(measurements.map((m) => [m.id, m]));

  return values
    .map((v) => ({ v, m: byId.get(v.measurementId) }))
    .filter((r): r is { v: StudyMeasureValue; m: (typeof measurements)[number] } => Boolean(r.m))
    .sort((a, b) => a.m.order - b.m.order || a.m.name.localeCompare(b.m.name))
    .map(({ v, m }) => ({ name: m.name, unit: m.unit, before: v.before ?? null, after: v.after ?? null }));
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
    const measureRows = await buildMeasureRows(study);
    const pdfBuffer = await renderToBuffer(<ReportTemplate study={study} measureRows={measureRows} />);
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
    const measureRows = await buildMeasureRows(study);
    const pdfBuffer = await renderToBuffer(<ReportTemplate study={study} measureRows={measureRows} />);

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

// ─── Combined (n8n automation) ─────────────────────────────────────────────────

/** Generate then send in one call — used by the n8n webhook. */
export async function generateAndDeliverReport(
  studyId: string,
  actorId: string
): Promise<ActionResult<{ reportUrl: string }>> {
  const generated = await generateReportForStudy(studyId, actorId);
  if (!generated.ok) return generated;
  return sendReportForStudy(studyId, actorId);
}
