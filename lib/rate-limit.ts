/**
 * Minimal in-memory sliding-window rate limiter for the MVP.
 *
 * Note: state is per-instance, so on multi-instance/serverless deployments
 * the effective limit scales with the number of instances. For production
 * hardening, swap this for @upstash/ratelimit backed by Redis — the
 * `rateLimit()` signature can stay the same.
 */

interface Window {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100; // per IP per window

const buckets = new Map<string, Window>();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  { max = MAX_REQUESTS, windowMs = WINDOW_MS }: { max?: number; windowMs?: number } = {}
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: max - 1, resetAt };
  }

  existing.count += 1;
  const success = existing.count <= max;
  return { success, remaining: Math.max(0, max - existing.count), resetAt: existing.resetAt };
}

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

// Opportunistic cleanup so the map doesn't grow unbounded.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, win] of buckets) {
      if (now >= win.resetAt) buckets.delete(key);
    }
  }, WINDOW_MS).unref?.();
}
