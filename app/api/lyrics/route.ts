import { findLyricsEmbed } from "@/lib/server/genius";
import { hasGenius } from "@/lib/server/env";
import { fail, json, preflight } from "@/lib/server/http";
import { rateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LEN = 200;

export function OPTIONS(req: Request) {
  return preflight(req);
}

/**
 * GET /api/lyrics?title=<song>&artist=<artist>
 *
 * Returns Genius's official embed for the given song, or `{ found: false }`
 * if there's no confident match (or lyrics aren't configured at all — that's
 * reported as a distinct `reason` so the UI can tell "not set up" apart from
 * "this song isn't on Genius").
 */
export async function GET(req: Request) {
  const rl = rateLimit(req, "lyrics");
  if (!rl.ok) {
    return fail(req, 429, "rate_limited", "Too many requests. Slow down.", {
      retryAfter: rl.retryAfter,
    });
  }

  const url = new URL(req.url);
  const title = (url.searchParams.get("title") ?? "").trim().slice(0, MAX_LEN);
  const artist = (url.searchParams.get("artist") ?? "").trim().slice(0, MAX_LEN) || "Seedhe Maut";

  if (!title) {
    return fail(req, 400, "invalid_query", "title is required");
  }

  if (!hasGenius()) {
    return json(
      req,
      { found: false, reason: "not_configured" },
      { headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const result = await findLyricsEmbed(title, artist);
    if (!result) {
      return json(req, { found: false }, { cacheSeconds: 3600, headers: rateLimitHeaders(rl) });
    }
    return json(
      req,
      { found: true, ...result },
      { cacheSeconds: 21_600, headers: rateLimitHeaders(rl) }
    );
  } catch (err) {
    // Lyrics are a soft enhancement — a Genius hiccup should never look like
    // a broken app, so this degrades to "not found" instead of a 502.
    console.warn("[lyrics] lookup failed:", (err as Error).message);
    return json(req, { found: false }, { headers: rateLimitHeaders(rl) });
  }
}
