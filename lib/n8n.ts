import type { NextRequest } from "next/server";

/**
 * Verifies a webhook request carries the shared n8n API key, using a
 * constant-time comparison to avoid leaking the key via timing attacks.
 */
export function verifyN8nRequest(req: NextRequest): boolean {
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = process.env.N8N_API_KEY;

  if (!apiKey || !expectedKey) return false;

  const encoder = new TextEncoder();
  const a = encoder.encode(apiKey);
  const b = encoder.encode(expectedKey);

  // Length check is not constant-time, but key length is not secret.
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}
