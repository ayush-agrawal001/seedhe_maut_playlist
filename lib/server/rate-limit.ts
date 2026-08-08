import "server-only";
import { env } from "./env";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

/** Drop expired buckets occasionally so the map can't grow without bound. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
}

export function clientIp(req: Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") || h.get("cf-connecting-ip") || "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Unix seconds. */
  reset: number;
  retryAfter: number;
}

/**
 * Fixed-window limiter, in-memory.
 *
 * NOTE: state is per server instance. On multi-instance/serverless hosting use
 * a shared store (e.g. Upstash Redis) — see README.
 */
export function rateLimit(req: Request, keySuffix = ""): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const { windowMs, max } = env.rateLimit;
  const key = `${clientIp(req)}:${keySuffix}`;
  let b = buckets.get(key);

  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;

  const remaining = Math.max(0, max - b.count);
  return {
    ok: b.count <= max,
    limit: max,
    remaining,
    reset: Math.ceil(b.resetAt / 1000),
    retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
  };
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  const h: Record<string, string> = {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(r.reset),
  };
  if (!r.ok) h["Retry-After"] = String(r.retryAfter);
  return h;
}
