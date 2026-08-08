import { getCatalog, pickRandom, playableTracks } from "@/lib/server/catalog";
import { fail, handleError, json, parseIdList, preflight } from "@/lib/server/http";
import { rateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import type { RandomResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req);
}

/**
 * GET /api/random
 *   ?exclude=<id>[,<id>...]   ids to avoid (pass recently played; first = most recent)
 *   ?playable=false           allow tracks with no embeddable video (default: only playable)
 *
 * Never returns the most recently played track unless it is the only option.
 */
export async function GET(req: Request) {
  const rl = rateLimit(req, "random");
  if (!rl.ok) {
    return fail(req, 429, "rate_limited", "Too many requests. Slow down.", {
      retryAfter: rl.retryAfter,
    });
  }

  try {
    const url = new URL(req.url);
    const exclude = parseIdList(url, "exclude", 50);

    const catalog = await getCatalog();
    const pool =
      url.searchParams.get("playable") === "false" ? catalog.tracks : playableTracks(catalog);

    if (!pool.length) {
      return fail(
        req,
        404,
        "empty_pool",
        "No playable tracks available. Check that the YouTube channel has embeddable official videos."
      );
    }

    const track = pickRandom(pool, exclude);
    if (!track) return fail(req, 404, "empty_pool", "No track could be selected.");

    const body: RandomResponse = { track, excluded: exclude, poolSize: pool.length };

    // Never cache — every call must be able to return a different song.
    return json(req, body, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleError(req, err);
  }
}
