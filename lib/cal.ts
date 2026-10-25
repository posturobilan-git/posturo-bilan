import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

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

const attendeeSchema = z.object({
  email: z.string().email(),
  name: z.string().nullish(),
  // Present only when the attendee's phone is stored on the booking.
  phoneNumber: z.string().nullish(),
});

/**
 * Minimal shape of a Cal.com booking webhook. Only the fields we consume are
 * validated; everything else is ignored.
 *
 * `responses` / `userFieldsResponses` hold the answers to the Event Type's
 * booking questions. Which questions exist (and so whether a phone number is
 * there at all) is the Event Type's configuration, not ours: they are typed
 * `unknown` so an unexpected shape can never reject a booking, and read
 * defensively by extractPhone.
 */
export const calWebhookSchema = z.object({
  triggerEvent: z.string(),
  payload: z.object({
    uid: z.string().nullish(),
    startTime: z.string().nullish(),
    attendees: z.array(attendeeSchema).nullish(),
    attendee: attendeeSchema.nullish(),
    // `.optional()` is required: in Zod 4 a bare `z.unknown()` key is NOT optional,
    // and a booking without these answers must still parse.
    responses: z.unknown().optional(),
    userFieldsResponses: z.unknown().optional(),
  }),
});

export type CalWebhook = z.infer<typeof calWebhookSchema>;

interface AttendeeFields {
  email: string;
  firstName: string;
  lastName: string;
  /** Valid phone number from the booking, in E.164 — null when the booking carries none. */
  phone: string | null;
  bookingId: string | null;
  startTime: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** The text of one booking answer: a bare string, or Cal.com's `{ value: "…" }`. */
function answerText(answer: unknown): string | null {
  if (typeof answer === "string") return answer;
  const value = asRecord(answer)?.value;
  return typeof value === "string" ? value : null;
}

// A custom booking question about the phone ("phone", "telephone", "mobile"…).
const PHONE_QUESTION = /phone|t[eé]l|mobile|portable/i;

/**
 * The attendee's phone number, when the booking has one. NEVER assumed present:
 * the Event Type may not ask for it, the attendee may skip it or type something
 * that isn't a number. Looks at the attendee's own `phoneNumber`, Cal.com's
 * `attendeePhoneNumber` system field, then any phone-like custom question; the
 * first value that is a valid number wins (E.164). Otherwise null — the accueil
 * form then collects it from the patient.
 */
export function extractPhone(data: CalWebhook): string | null {
  const p = data.payload;
  const attendee = p.attendees?.[0] ?? p.attendee;

  const candidates: unknown[] = [attendee?.phoneNumber];
  for (const source of [p.responses, p.userFieldsResponses]) {
    const answers = asRecord(source);
    if (!answers) continue;
    candidates.push(answers.attendeePhoneNumber);
    for (const [question, answer] of Object.entries(answers)) {
      if (PHONE_QUESTION.test(question)) candidates.push(answer);
    }
  }

  for (const candidate of candidates) {
    const phone = normalizePhone(answerText(candidate));
    if (phone) return phone;
  }
  return null;
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
    phone: extractPhone(data),
    bookingId: p.uid ?? null,
    startTime: p.startTime ?? null,
  };
}
