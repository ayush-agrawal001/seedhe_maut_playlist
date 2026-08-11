import "server-only";
import { env, hasGenius } from "./env";
import { cached } from "./cache";

const API = "https://api.genius.com";

/**
 * Lyrics display.
 *
 * We never read, store, or render raw lyric text ourselves — that's
 * copyrighted content requiring a publisher licence Genius itself holds.
 * Instead we use `embed_content`, the exact <div>+<script> snippet Genius's
 * API hands out specifically for third-party display: their sanctioned
 * mechanism, the lyrics equivalent of YouTube's IFrame player for video. The
 * script is Genius's own, runs on genius.com's infrastructure, and renders
 * with their attribution and ads intact.
 */

interface GeniusHit {
  result: {
    id: number;
    title: string;
    url: string;
    primary_artist?: { name: string };
  };
}

interface GeniusSearchResponse {
  response: { hits: GeniusHit[] };
}

interface GeniusSongResponse {
  response: {
    song: {
      id: number;
      url: string;
      title: string;
      embed_content?: string;
    };
  };
}

async function geniusFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T | null> {
  if (!hasGenius()) return null;

  const qs = new URLSearchParams(params);
  const res = await fetch(`${API}${path}${qs.toString() ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${env.genius.accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9ऀ-ॿ]+/g, "");

/**
 * How closely a Genius hit's own song title matches what we searched for.
 * Genius's search ranks by broad relevance, not title match — an
 * artist-only filter let "Toota" resolve to "Namastute" (same artist,
 * unrelated song) before this existed, which is worse than showing nothing.
 */
function titleScore(want: string, got: string): number {
  const a = norm(want);
  const b = norm(got);
  if (!a || !b) return 0;
  if (a === b) return 1;
  // Short titles ("W", "TT") are too easy to false-match by substring.
  if (a.length < 4) return 0;
  if (b.startsWith(a) || a.startsWith(b)) return 0.9;
  if (b.includes(a) || a.includes(b)) return 0.75;
  return 0;
}
const MIN_TITLE_SCORE = 0.75;

export interface LyricsResult {
  title: string;
  geniusUrl: string;
  embedContent: string;
}

/**
 * Finds the Genius embed for a track, cached for a week (lyrics don't
 * change). A miss is cached too, but briefly — the title cleanup or the
 * catalogue itself can change what we search for.
 */
export async function findLyricsEmbed(
  title: string,
  artist: string
): Promise<LyricsResult | null> {
  const cacheKey = `genius:v1:${norm(title)}:${norm(artist)}`;

  return cached(cacheKey, (v: LyricsResult | null) => (v ? 604_800 : 21_600), async () => {
    const search = await geniusFetch<GeniusSearchResponse>("/search", {
      q: `${title} ${artist}`,
    });
    const hits = search?.response?.hits ?? [];
    if (!hits.length) return null;

    // Genius search ranks by relevance, not title match, and can surface a
    // different song by the same artist. Score every artist-plausible hit by
    // title closeness and take the best, rather than the first artist match.
    const wantedArtist = norm(artist);
    let candidate: GeniusHit | null = null;
    let bestScore = 0;

    for (const h of hits) {
      const got = norm(h.result.primary_artist?.name ?? "");
      const artistOk =
        got && (got.includes("seedhemaut") || got.includes(wantedArtist) || wantedArtist.includes(got));
      if (!artistOk) continue;

      const s = titleScore(title, h.result.title);
      if (s > bestScore) {
        bestScore = s;
        candidate = h;
      }
    }
    if (!candidate || bestScore < MIN_TITLE_SCORE) return null;

    const full = await geniusFetch<GeniusSongResponse>(`/songs/${candidate.result.id}`, {
      text_format: "html",
    });
    const song = full?.response?.song;
    if (!song?.embed_content) return null;

    return { title: song.title, geniusUrl: song.url, embedContent: song.embed_content };
  });
}
