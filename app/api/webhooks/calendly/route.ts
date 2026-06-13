import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isLocalEnv } from "@/lib/env";
import { inviteExpiryFromNow } from "@/lib/legal";
import { sendIntakeEmail } from "@/lib/emails";
import {
  verifyCalendlySignature,
  calendlyWebhookSchema,
  extractInvitee,
} from "@/lib/calendly";

/**
 * Native Calendly intake webhook.
 *
 * On a new booking (`invitee.created`): verify the signature, upsert the patient
 * by email, and email them their "formulaire d'accueil" link via sendIntakeEmail.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CALENDLY_WEBHOOK_SECRET;
  const raw = await req.text();

  // Signature is required whenever the secret is configured. Locally, with no
  // secret set, we allow unsigned calls so the flow can be tested; a deployment
  // without the secret fails closed.
  if (secret) {
    const ok = verifyCalendlySignature(
      raw,
      req.headers.get("calendly-webhook-signature"),
      secret
    );
    if (!ok) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  } else if (!isLocalEnv()) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 401 });
  }

  let data;
  try {
    data = calendlyWebhookSchema.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Only new bookings create patients; acknowledge anything else so Calendly
  // doesn't retry.
  if (data.event !== "invitee.created") {
    return NextResponse.json({ success: true, ignored: data.event });
  }

  const invitee = extractInvitee(data);
  if (!invitee.kineId) {
    return NextResponse.json({ error: "Missing kineId in Calendly custom fields" }, { status: 400 });
  }

  const kine = await prisma.user.findFirst({
    where: { id: invitee.kineId, role: { in: ["ADMIN", "KINE"] } },
    select: { id: true },
  });
  if (!kine) {
    return NextResponse.json({ error: "Unknown or inactive kiné" }, { status: 400 });
  }

  try {
    const patient = await prisma.patient.upsert({
      where: { email: invitee.email },
      create: {
        email: invitee.email,
        firstName: invitee.firstName,
        lastName: invitee.lastName,
        kineId: kine.id,
        calendlyEventId: invitee.calendlyEventId,
        inviteToken: randomUUID(),
        inviteExpiresAt: inviteExpiryFromNow(),
      },
      update: { calendlyEventId: invitee.calendlyEventId },
      select: { id: true },
    });

    await logAudit({
      userId: kine.id,
      action: "CREATE",
      entity: "patient",
      entityId: patient.id,
      metadata: { source: "calendly", startTime: invitee.startTime },
    });

    const sent = await sendIntakeEmail(patient.id);
    if (!sent.ok) {
      // Patient is recorded; surface the email failure for retry/visibility.
      return NextResponse.json(
        { success: true, patientId: patient.id, emailError: sent.error },
        { status: 207 }
      );
    }

    return NextResponse.json({ success: true, patientId: patient.id });
  } catch (e) {
    console.error("POST /api/webhooks/calendly failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
