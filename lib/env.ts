/**
 * Whether the app is running on a developer's local machine (as opposed to a
 * deployment — preview, staging, or production).
 *
 * Detection:
 *  - Explicit override via `APP_ENV` ("local" | "staging" | "production").
 *  - Otherwise, any Vercel deployment sets `VERCEL=1`, so absence of it = local.
 *
 * This is deliberately NOT based on NODE_ENV: `next start` / `next build` set
 * NODE_ENV=production even on your laptop, but those runs are still "local"
 * and should use the local filesystem + optional email. A deployed staging
 * env, by contrast, must use the real Blob + email delivery flow.
 */
export function isLocalEnv(): boolean {
  if (process.env.APP_ENV) return process.env.APP_ENV === "local";
  return process.env.VERCEL !== "1";
}
