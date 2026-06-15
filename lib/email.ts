import { Resend } from "resend";

let client: Resend | null = null;

/**
 * Lazily-constructed Resend client. Constructing eagerly at import time
 * throws when RESEND_API_KEY is unset, which would crash any route that
 * imports this module. Callers should guard on RESEND_API_KEY before use.
 */
export function getResend(): Resend {
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

/**
 * Sender address for all outbound emails, sanitised: strips surrounding quotes
 * and trims whitespace/newlines. Env values pasted into hosting dashboards often
 * pick up a trailing newline, which makes Resend reject the `from` field
 * ("Invalid `from` field … format"). Falls back to Resend's shared test sender.
 */
export function resendFrom(): string {
  const raw = process.env.RESEND_FROM_EMAIL?.trim().replace(/^['"]|['"]$/g, "").trim();
  return raw || "PosturoBilan <onboarding@resend.dev>";
}
