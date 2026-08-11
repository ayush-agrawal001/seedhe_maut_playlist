import "server-only";
import { cached } from "./cache";

const API = "https://lrclib.net/api";

/**
 * Synced (timestamped) lyrics via lrclib.net — a free, public, community-run
 * LRC database. No auth, no scraping (a documented REST API), but the lyric
 * text itself is community-submitted rather than formally licensed from a
 * publisher the way Genius's embed is. That's a real, deliberate tradeoff,
 * made explicitly rather than defaulted into.
 */

export interface SyncedLine {
  time: number; // seconds
  text: string;
}

export interface SyncedLyricsResult {
  lines: SyncedLine[];
}

interface LrclibHit {
  trackName: string;
  artistName: string;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

async function lrclibFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      // lrclib asks integrators to identify themselves — basic API courtesy.
      headers: { "User-Agent": "SeedheMautPlayer/1.0 (+https://www.seedhemaut.world)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

/** "[01:02.34]line text" -> { time: 62.34, text: "line text" } */
function parseLRC(lrc: string): SyncedLine[] {
  const lines: SyncedLine[] = [];
  const re = /^\[(\d+):(\d+)(?:\.(\d+))?\](.*)$/;
  for (const raw of lrc.split("\n")) {
    const m = re.exec(raw.trim());
    if (!m) continue;
    const [, mm, ss, frac, text] = m;
    const time = Number(mm) * 60 + Number(ss) + Number(`0.${frac ?? "0"}`);
    const clean = text.trim();
    if (clean) lines.push({ time, text: clean });
  }
  return lines.sort((a, b) => a.time - b.time);
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9ऀ-ॿ]+/g, "");

/** Same discipline as the Genius matcher: score title closeness, don't just
 *  take the first artist-plausible hit — see lib/server/genius.ts for why. */
function titleScore(want: string, got: string): number {
  const a = norm(want);
  const b = norm(got);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 4) return 0;
  if (b.startsWith(a) || a.startsWith(b)) return 0.9;
  if (b.includes(a) || a.includes(b)) return 0.75;
  return 0;
}
const MIN_TITLE_SCORE = 0.75;

export async function findSyncedLyrics(
  title: string,
  artist: string
): Promise<SyncedLyricsResult | null> {
  const cacheKey = `lrclib:v1:${norm(title)}:${norm(artist)}`;

  return cached(cacheKey, (v: SyncedLyricsResult | null) => (v ? 604_800 : 21_600), async () => {
    const qs = new URLSearchParams({ track_name: title, artist_name: artist });
    const hits = await lrclibFetch<LrclibHit[]>(`/search?${qs}`);
    if (!hits?.length) return null;

    let best: LrclibHit | null = null;
    let bestScore = 0;
    for (const h of hits) {
      if (h.instrumental || !h.syncedLyrics) continue;
      const got = norm(h.artistName);
      const wanted = norm(artist);
      const artistOk = got && (got.includes("seedhemaut") || got.includes(wanted) || wanted.includes(got));
      if (!artistOk) continue;

      const s = titleScore(title, h.trackName);
      if (s > bestScore) {
        bestScore = s;
        best = h;
      }
    }
    if (!best || bestScore < MIN_TITLE_SCORE) return null;

    const lines = parseLRC(best.syncedLyrics!);
    return lines.length ? { lines } : null;
  });
}
