import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Verifies a Cal.com webhook signature.
 *
 * Cal.com sends `X-Cal-Signature-256: <hex hmac>` where the HMAC is SHA-256 over
 * the raw request body keyed by the webhook's secret. We recompute it and
 * compare in constant time.
 *
 * `rawBody` MUST be the exact bytes received (via `await req.text()`) — JSON
 * re-encoding would change the signature.
 */
export function verifyCalSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  // Trim defends against a trailing newline/space accidentally pasted into the
  // env var (a common cause of "secret is set but still 401").
  const expected = createHmac("sha256", secret.trim()).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Safe, non-secret diagnostics for a failed signature check — logged so a single
 * ping reveals the cause (missing header vs. value/whitespace mismatch) without
 * leaking the secret or the full signature.
 */
export function calSignatureDiagnostics(
  rawBody: string,
  signature: string | null,
  secret: string
) {
  const expected = createHmac("sha256", secret.trim()).update(rawBody).digest("hex");
  return {
    hasSignatureHeader: Boolean(signature),
    secretLength: secret.length,
    secretTrimmedLength: secret.trim().length,
    bodyLength: rawBody.length,
    receivedPrefix: signature?.trim().slice(0, 10) ?? null,
    expectedPrefix: expected.slice(0, 10),
    match: signature != null && expected === signature.trim(),
  };
}

// ─── Payload ─────────────────────────────────────────────────────────────────

const attendeeSchema = z.object({ email: z.string().email(), name: z.string().nullish() });

/**
 * Minimal shape of a Cal.com booking webhook. Only the fields we consume are
 * validated; everything else is ignored.
 */
export const calWebhookSchema = z.object({
  triggerEvent: z.string(),
  payload: z.object({
    uid: z.string().nullish(),
    startTime: z.string().nullish(),
    attendees: z.array(attendeeSchema).nullish(),
    attendee: attendeeSchema.nullish(),
  }),
});

export type CalWebhook = z.infer<typeof calWebhookSchema>;

interface AttendeeFields {
  email: string;
  firstName: string;
  lastName: string;
  bookingId: string | null;
  startTime: string | null;
}

/**
 * Pulls the patient/booking fields we care about out of a Cal.com payload.
 * Handles both the `attendees[]` array and the singular `attendee` shape.
 */
export function extractAttendee(data: CalWebhook): AttendeeFields | null {
  const p = data.payload;
  const attendee = p.attendees?.[0] ?? p.attendee;
  if (!attendee) return null;

  let firstName = "";
  let lastName = "";
  if (attendee.name) {
    const [first, ...rest] = attendee.name.trim().split(/\s+/);
    firstName = first ?? "";
    lastName = rest.join(" ");
  }

  return {
    email: attendee.email,
    firstName: firstName || "Patient",
    lastName,
    bookingId: p.uid ?? null,
    startTime: p.startTime ?? null,
  };
}
