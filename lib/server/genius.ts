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

    // Genius search is fuzzy and can return an unrelated song for a short or
    // common title — only accept a hit plausibly credited to this artist.
    const wantedArtist = norm(artist);
    const candidate =
      hits.find((h) => {
        const got = norm(h.result.primary_artist?.name ?? "");
        if (!got) return false;
        return got.includes("seedhemaut") || got.includes(wantedArtist) || wantedArtist.includes(got);
      }) ?? null;
    if (!candidate) return null;

    const full = await geniusFetch<GeniusSongResponse>(`/songs/${candidate.result.id}`, {
      text_format: "html",
    });
    const song = full?.response?.song;
    if (!song?.embed_content) return null;

    return { title: song.title, geniusUrl: song.url, embedContent: song.embed_content };
  });
}
