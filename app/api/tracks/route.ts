import { getCatalog, playableTracks } from "@/lib/server/catalog";
import { env } from "@/lib/server/env";
import { fail, handleError, json, parsePaging, preflight } from "@/lib/server/http";
import { rateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import type { TracksResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req);
}

/**
 * GET /api/tracks
 *   ?album=<albumId>      filter to one album
 *   ?playable=true        only tracks with an embeddable official video
 *   ?limit=  &offset=     paging (limit 1..200)
 */
export async function GET(req: Request) {
  const rl = rateLimit(req, "tracks");
  if (!rl.ok) {
    return fail(req, 429, "rate_limited", "Too many requests. Slow down.", {
      retryAfter: rl.retryAfter,
    });
  }

  try {
    const url = new URL(req.url);
    const paging = parsePaging(url, 200);
    if (!paging.ok) return fail(req, 400, "invalid_query", paging.error);

    const album = url.searchParams.get("album");
    if (album && !/^[\w-]{1,64}$/.test(album)) {
      return fail(req, 400, "invalid_query", "album must be a valid album id");
    }

    const catalog = await getCatalog();
    let list = url.searchParams.get("playable") === "true"
      ? playableTracks(catalog)
      : catalog.tracks;

    if (album) list = list.filter((t) => t.albumId === album);

    const body: TracksResponse = {
      meta: { ...catalog.meta, totalTracks: list.length },
      tracks: list.slice(paging.offset, paging.offset + paging.limit),
    };

    return json(req, body, {
      cacheSeconds: env.cache.ttl,
      headers: rateLimitHeaders(rl),
    });
  } catch (err) {
    return handleError(req, err);
  }
}
