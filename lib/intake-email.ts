import "server-only";
import { getResend } from "@/lib/email";
import { AccueilEmail } from "@/lib/emails/AccueilEmail";
import { isLocalEnv } from "@/lib/env";

const CABINET = process.env.CABINET_NAME || "PosturoBilan";
const FROM = process.env.RESEND_FROM_EMAIL || "PosturoBilan <onboarding@resend.dev>";

type SendResult =
  | { ok: true; emailed: boolean }
  | { ok: false; error: string };

/**
 * Sends the "formulaire d'accueil" invitation to a patient.
 *
 * Mirrors the report-email gating: a deployment must have RESEND_API_KEY set,
 * but local dev may skip the actual send (link is logged instead) so the flow
 * stays testable without a mail provider.
 */
export async function sendIntakeInviteEmail(params: {
  to: string;
  firstName: string;
  formUrl: string;
}): Promise<SendResult> {
  const canEmail = Boolean(process.env.RESEND_API_KEY);

  if (!isLocalEnv() && !canEmail) {
    return { ok: false, error: "Envoi d'email non configuré (RESEND_API_KEY manquant)." };
  }

  if (!canEmail) {
    console.warn(`[accueil] Email ignoré (RESEND_API_KEY absent). Lien : ${params.formUrl}`);
    return { ok: true, emailed: false };
  }

  const { error } = await getResend().emails.send({
    from: FROM,
    to: params.to,
    subject: "Complétez votre formulaire d'accueil",
    react: AccueilEmail({
      patientFirstName: params.firstName,
      cabinetName: CABINET,
      formUrl: params.formUrl,
    }),
  });

  if (error) {
    console.error("Resend error (accueil):", error);
    return { ok: false, error: "L'email n'a pas pu être envoyé." };
  }

  return { ok: true, emailed: true };
}
