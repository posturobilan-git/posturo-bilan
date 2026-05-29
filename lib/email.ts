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
