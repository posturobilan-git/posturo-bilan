import "server-only";
import { randomUUID } from "node:crypto";
import type { ReactElement } from "react";
import { prisma } from "@/lib/db";
import { getResend } from "@/lib/email";
import { appBaseUrl } from "@/lib/app-url";
import { logAudit } from "@/lib/audit";
import { isLocalEnv } from "@/lib/env";
import { inviteExpiryFromNow } from "@/lib/legal";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { generateAndDeliverReport } from "@/lib/report";
import { AccueilEmail } from "@/lib/emails/AccueilEmail";
import { FollowupEmail } from "@/lib/emails/FollowupEmail";

/**
 * Single home for every outbound transactional email. Each function fetches
 * the data it needs, renders its Resend template, sends it, and writes an audit
 * entry. They contain no Clerk auth — callers (server actions, the Calendly
 * webhook, the cron route) are responsible for their own authorization.
 *
 * Email gating mirrors the report flow: a deployment must have RESEND_API_KEY,
 * but local dev may skip the actual send (the link is logged) so flows stay
 * testable without a mail provider.
 */

const CABINET = process.env.CABINET_NAME || "PosturoBilan";
const FROM = process.env.RESEND_FROM_EMAIL || "PosturoBilan <onboarding@resend.dev>";

type Sendable = { subject: string; react: ReactElement; to: string };

/** Returns true if the email was actually sent, false if skipped locally. */
async function deliver({ subject, react, to }: Sendable): Promise<ActionResult<{ emailed: boolean }>> {
  const canEmail = Boolean(process.env.RESEND_API_KEY);

  if (!isLocalEnv() && !canEmail) {
    return fail("Envoi d'email non configuré (RESEND_API_KEY manquant).");
  }
  if (!canEmail) {
    console.warn(`[emails] Email ignoré (RESEND_API_KEY absent) — destinataire ${to}, sujet « ${subject} ».`);
    return ok({ emailed: false });
  }

  const { error } = await getResend().emails.send({ from: FROM, to, subject, react });
  if (error) {
    console.error("Resend error:", error);
    return fail("L'email n'a pas pu être envoyé.");
  }
  return ok({ emailed: true });
}

// ─── Intake / formulaire d'accueil ──────────────────────────────────────────────

/**
 * Emails the patient their "formulaire d'accueil" link. Ensures a valid invite
 * token exists and refreshes its 30-day expiry. Called by the BO button, and by
 * the Calendly webhook on a new booking.
 */
export async function sendIntakeEmail(patientId: string): Promise<ActionResult<void>> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      firstName: true,
      email: true,
      kineId: true,
      isAnonymized: true,
      inviteToken: true,
      inviteCompletedAt: true,
    },
  });
  if (!patient) return fail("Patient introuvable.");
  if (patient.isAnonymized) return fail("Patient anonymisé — envoi impossible.");
  if (patient.inviteCompletedAt) return fail("Le formulaire d'accueil a déjà été complété.");

  const token = patient.inviteToken ?? randomUUID();
  await prisma.patient.update({
    where: { id: patient.id },
    data: { inviteToken: token, inviteExpiresAt: inviteExpiryFromNow(), inviteSentAt: new Date() },
  });

  const formUrl = `${await appBaseUrl()}/accueil/${token}`;
  const sent = await deliver({
    to: patient.email,
    subject: "Complétez votre formulaire d'accueil",
    react: AccueilEmail({ patientFirstName: patient.firstName, cabinetName: CABINET, formUrl }),
  });
  if (!sent.ok) return sent;

  await logAudit({
    userId: patient.kineId,
    action: "UPDATE",
    entity: "intake",
    entityId: patient.id,
    metadata: { action: "send_email", emailed: sent.data.emailed },
  });
  return ok(undefined);
}

// ─── Rapport PDF ────────────────────────────────────────────────────────────────

/**
 * Generates (if needed) and emails the PDF report to the patient, advancing the
 * study to report_sent. Thin wrapper over the report pipeline so all sends live
 * here; the heavy PDF rendering stays in lib/report.
 */
export async function sendReportEmail(studyId: string): Promise<ActionResult<{ reportUrl: string }>> {
  const study = await prisma.study.findUnique({ where: { id: studyId }, select: { kineId: true } });
  if (!study) return fail("Étude introuvable.");
  return generateAndDeliverReport(studyId, study.kineId);
}

// ─── Suivi J+30 ──────────────────────────────────────────────────────────────────

/**
 * Emails the patient the J+30 follow-up link for a study. Ensures a follow-up
 * token exists, then advances the study report_sent → followup_pending. Called
 * by the daily cron for every eligible study.
 */
export async function sendFollowupEmail(studyId: string): Promise<ActionResult<void>> {
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: {
      id: true,
      kineId: true,
      status: true,
      followupToken: true,
      followupCompletedAt: true,
      patient: { select: { firstName: true, email: true, isAnonymized: true } },
    },
  });
  if (!study) return fail("Étude introuvable.");
  if (study.patient.isAnonymized) return fail("Patient anonymisé — envoi impossible.");
  if (study.followupCompletedAt) return fail("Le suivi a déjà été complété.");

  const token = study.followupToken ?? randomUUID();
  await prisma.study.update({ where: { id: study.id }, data: { followupToken: token } });

  const formUrl = `${await appBaseUrl()}/suivi/${token}`;
  const sent = await deliver({
    to: study.patient.email,
    subject: "Votre suivi à 30 jours — étude posturale",
    react: FollowupEmail({ patientFirstName: study.patient.firstName, cabinetName: CABINET, formUrl }),
  });
  if (!sent.ok) return sent;

  // Advance report_sent → followup_pending (never downgrade a completed follow-up).
  await prisma.study.updateMany({
    where: { id: study.id, status: "report_sent" },
    data: { status: "followup_pending" },
  });

  await logAudit({
    userId: study.kineId,
    action: "UPDATE",
    entity: "followup",
    entityId: study.id,
    metadata: { action: "send_email", emailed: sent.data.emailed },
  });
  return ok(undefined);
}
