"use server";

import { prisma } from "@/lib/db";
import { requireKine } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { fail, type ActionResult } from "@/lib/action-result";
import { generateReportForStudy, sendReportForStudy } from "@/lib/report";

type AuthzResult =
  | { ok: false; error: string }
  | { ok: true; kineId: string; patientId: string };

/** Verifies the study exists and the kiné may act on it. */
async function authorizeStudy(studyId: string): Promise<AuthzResult> {
  const kine = await requireKine();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { patientId: true, patient: { select: { kineId: true } } },
  });
  if (!study) return { ok: false, error: "Étude introuvable." };
  if (kine.role !== "ADMIN" && study.patient.kineId !== kine.id) {
    return { ok: false, error: "Accès refusé à cette étude." };
  }
  return { ok: true, kineId: kine.id, patientId: study.patientId };
}

/**
 * Generates the PDF report and stores it (downloadable), without emailing
 * the patient or changing their status.
 */
export async function generateReport(
  studyId: string
): Promise<ActionResult<{ reportUrl: string }>> {
  const auth = await authorizeStudy(studyId);
  if (!auth.ok) return fail(auth.error);

  const result = await generateReportForStudy(studyId, auth.kineId);
  if (result.ok) revalidatePath(`/dashboard/patients/${auth.patientId}`);
  return result;
}

/**
 * Emails the already-generated report to the patient and advances the
 * study to report_sent.
 */
export async function sendReport(
  studyId: string
): Promise<ActionResult<{ reportUrl: string }>> {
  const auth = await authorizeStudy(studyId);
  if (!auth.ok) return fail(auth.error);

  const result = await sendReportForStudy(studyId, auth.kineId);
  if (result.ok) {
    revalidatePath(`/dashboard/patients/${auth.patientId}`);
    revalidatePath("/dashboard/etudes");
  }
  return result;
}
