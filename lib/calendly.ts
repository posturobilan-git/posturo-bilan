import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Verifies a Calendly webhook signature.
 *
 * Calendly sends `Calendly-Webhook-Signature: t=<unix>,v1=<hex hmac>` where the
 * HMAC is SHA-256 over `"<t>.<rawBody>"` keyed by the subscription's signing
 * key. We recompute it and compare in constant time.
 *
 * `rawBody` MUST be the exact bytes received (read via `await req.text()`),
 * not a re-serialized object — JSON re-encoding would change the signature.
 */
export function verifyCalendlySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim(), v?.trim()];
    })
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─── Payload ─────────────────────────────────────────────────────────────────

/**
 * Minimal shape of a Calendly `invitee.created` webhook payload. Only the
 * fields we consume are validated; everything else is ignored.
 */
export const calendlyWebhookSchema = z.object({
  event: z.string(),
  payload: z.object({
    email: z.string().email(),
    name: z.string().nullish(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    scheduled_event: z
      .object({ uri: z.string().nullish(), start_time: z.string().nullish() })
      .nullish(),
    questions_and_answers: z
      .array(z.object({ question: z.string(), answer: z.string() }))
      .nullish(),
    tracking: z
      .object({ utm_content: z.string().nullish(), utm_source: z.string().nullish() })
      .nullish(),
  }),
});

export type CalendlyWebhook = z.infer<typeof calendlyWebhookSchema>;

interface InviteeFields {
  email: string;
  firstName: string;
  lastName: string;
  kineId: string | null;
  calendlyEventId: string | null;
  startTime: string | null;
}

/**
 * Pulls the patient/booking fields we care about out of a Calendly payload.
 * `kineId` is read from a custom question containing "kiné"/"kine" first, then
 * falls back to the `utm_content` tracking param.
 */
export function extractInvitee(data: CalendlyWebhook): InviteeFields {
  const p = data.payload;

  let firstName = p.first_name?.trim() ?? "";
  let lastName = p.last_name?.trim() ?? "";
  if (!firstName && !lastName && p.name) {
    const [first, ...rest] = p.name.trim().split(/\s+/);
    firstName = first ?? "";
    lastName = rest.join(" ");
  }

  const kineAnswer = p.questions_and_answers?.find((qa) =>
    /kin[eé]/i.test(qa.question)
  )?.answer;
  const kineId = (kineAnswer ?? p.tracking?.utm_content ?? null)?.trim() || null;

  return {
    email: p.email,
    firstName: firstName || "Patient",
    lastName: lastName || "",
    kineId,
    calendlyEventId: p.scheduled_event?.uri ?? null,
    startTime: p.scheduled_event?.start_time ?? null,
  };
}
