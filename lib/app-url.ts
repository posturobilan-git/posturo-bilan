import "server-only";
import { headers } from "next/headers";

/**
 * Public base URL of the app, used to build absolute links in emails.
 *
 * - In production, set `NEXT_PUBLIC_APP_URL` (no trailing slash).
 * - Locally it is derived from the incoming request headers.
 */
export async function appBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
