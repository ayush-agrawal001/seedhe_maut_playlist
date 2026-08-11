import { findLyricsEmbed } from "@/lib/server/genius";
import { findSyncedLyrics } from "@/lib/server/lrclib";
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
 * Tries lrclib.net first for real timestamped lyrics (synced highlighting in
 * the UI); if that song isn't there, falls back to Genius's official static
 * embed so something still shows. `kind` on the response tells the client
 * which one it got, since they render completely differently.
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

  // 1) Synced lyrics, free and tokenless — the primary path.
  try {
    const synced = await findSyncedLyrics(title, artist);
    if (synced) {
      return json(
        req,
        { found: true, kind: "synced", lines: synced.lines },
        { cacheSeconds: 21_600, headers: rateLimitHeaders(rl) }
      );
    }
  } catch (err) {
    console.warn("[lyrics] lrclib lookup failed:", (err as Error).message);
  }

  // 2) Genius's official embed — static, but licensed, and covers songs
  // lrclib doesn't have.
  if (!hasGenius()) {
    return json(req, { found: false }, { headers: rateLimitHeaders(rl) });
  }

  try {
    const result = await findLyricsEmbed(title, artist);
    if (!result) {
      return json(req, { found: false }, { cacheSeconds: 3600, headers: rateLimitHeaders(rl) });
    }
    return json(
      req,
      { found: true, kind: "genius", ...result },
      { cacheSeconds: 21_600, headers: rateLimitHeaders(rl) }
    );
  } catch (err) {
    // Lyrics are a soft enhancement — a Genius hiccup should never look like
    // a broken app, so this degrades to "not found" instead of a 502.
    console.warn("[lyrics] genius lookup failed:", (err as Error).message);
    return json(req, { found: false }, { headers: rateLimitHeaders(rl) });
  }
}
