import { getCatalog } from "@/lib/server/catalog";
import { env } from "@/lib/server/env";
import { fail, handleError, json, preflight } from "@/lib/server/http";
import { rateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import type { AlbumsResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req);
}

/** GET /api/albums — album list with artwork and track counts. */
export async function GET(req: Request) {
  const rl = rateLimit(req, "albums");
  if (!rl.ok) {
    return fail(req, 429, "rate_limited", "Too many requests. Slow down.", {
      retryAfter: rl.retryAfter,
    });
  }

  try {
    const catalog = await getCatalog();
    const body: AlbumsResponse = { meta: catalog.meta, albums: catalog.albums };
    return json(req, body, {
      cacheSeconds: env.cache.ttl,
      headers: rateLimitHeaders(rl),
    });
  } catch (err) {
    return handleError(req, err);
  }
}
