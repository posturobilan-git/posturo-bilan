import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { getResend } from "@/lib/email";
import { storePdf } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { ReportTemplate } from "@/components/pdf/ReportTemplate";
import { ReportEmail } from "@/lib/emails/ReportEmail";
import { isLocalEnv } from "@/lib/env";
import type { StudyForReport } from "@/types";

const CABINET = process.env.CABINET_NAME || "PosturoBilan";
const FROM = process.env.RESEND_FROM_EMAIL || "PosturoBilan <onboarding@resend.dev>";

function buildAdjustments(study: StudyForReport): string[] {
  return study.componentsUsed.map((c) =>
    [c.category, c.name, c.brand].filter(Boolean).join(" — ")
  );
}

async function fetchStudyForReport(studyId: string): Promise<StudyForReport | null> {
  return (await prisma.postureStudy.findUnique({
    where: { id: studyId },
    include: {
      componentsUsed: true,
      exercisesPrescribed: true,
      kine: true,
      patient: { include: { intake: true } },
    },
  })) as StudyForReport | null;
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
    const pdfBuffer = await renderToBuffer(<ReportTemplate study={study} />);
    const url = await storePdf(`reports/${studyId}.pdf`, pdfBuffer);

    await prisma.postureStudy.update({
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
 * patient to report_sent. Requires the report to have been generated first.
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
    const pdfBuffer = await renderToBuffer(<ReportTemplate study={study} />);

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

    await prisma.postureStudy.update({
      where: { id: studyId },
      data: { reportSentAt: new Date() },
    });

    if (study.patient.status === "study_completed") {
      await prisma.patient.update({
        where: { id: study.patientId },
        data: { status: "report_sent" },
      });
    }

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
