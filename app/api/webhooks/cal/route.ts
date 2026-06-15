import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isLocalEnv } from "@/lib/env";
import { inviteExpiryFromNow } from "@/lib/legal";
import { sendIntakeEmail } from "@/lib/emails";
import {
  verifyCalSignature,
  calSignatureDiagnostics,
  calWebhookSchema,
  extractAttendee,
} from "@/lib/cal";

/**
 * Cal.com booking webhook.
 *
 * One Event Type per kiné, each with its own webhook URL carrying the kiné id as
 * a query param: `/api/webhooks/cal?kineId=<uuid>`.
 *
 * On `BOOKING_CREATED`: verify the signature, upsert the patient by email, and
 * email them their "formulaire d'accueil" link via sendIntakeEmail.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CAL_WEBHOOK_SECRET;
  const raw = await req.text();

  // Signature is required whenever the secret is configured. Locally, with no
  // secret set, unsigned calls are allowed so the flow can be tested; a
  // deployment without the secret fails closed.
  if (secret) {
    const signature = req.headers.get("x-cal-signature-256");
    if (!verifyCalSignature(raw, signature, secret)) {
      // Safe diagnostics (no secret/full-signature) so one ping shows the cause.
      console.error("[cal webhook] signature check failed", calSignatureDiagnostics(raw, signature, secret));
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!isLocalEnv()) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 401 });
  }

  let data;
  try {
    data = calWebhookSchema.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Only new bookings create patients; acknowledge anything else so Cal.com
  // doesn't retry.
  if (data.triggerEvent !== "BOOKING_CREATED") {
    return NextResponse.json({ success: true, ignored: data.triggerEvent });
  }

  const kineId = new URL(req.url).searchParams.get("kineId");
  if (!kineId) {
    return NextResponse.json({ error: "kineId manquant" }, { status: 400 });
  }

  const attendee = extractAttendee(data);
  if (!attendee) {
    return NextResponse.json({ error: "No attendee in payload" }, { status: 400 });
  }

  const kine = await prisma.user.findFirst({
    where: { id: kineId, role: { in: ["ADMIN", "KINE"] } },
    select: { id: true },
  });
  if (!kine) {
    return NextResponse.json({ error: "Unknown or inactive kiné" }, { status: 400 });
  }

  try {
    const patient = await prisma.patient.upsert({
      where: { email: attendee.email },
      create: {
        email: attendee.email,
        firstName: attendee.firstName,
        lastName: attendee.lastName,
        kineId: kine.id,
        bookingId: attendee.bookingId,
        inviteToken: randomUUID(),
        inviteExpiresAt: inviteExpiryFromNow(),
      },
      update: { bookingId: attendee.bookingId },
      select: { id: true },
    });

    await logAudit({
      userId: kine.id,
      action: "CREATE",
      entity: "patient",
      entityId: patient.id,
      metadata: { source: "cal.com", startTime: attendee.startTime },
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
    console.error("POST /api/webhooks/cal failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
