import "server-only";

/**
 * Server-side configuration. These are read from process.env and NEVER shipped
 * to the browser — nothing here is prefixed with NEXT_PUBLIC_.
 */

function str(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  spotify: {
    clientId: str("SPOTIFY_CLIENT_ID"),
    clientSecret: str("SPOTIFY_CLIENT_SECRET"),
    /** Optional: skips an artist-search call when provided. */
    artistId: str("SPOTIFY_ARTIST_ID", "2oBG74gAocPMFv6Ij9ykdo"),
    market: str("SPOTIFY_MARKET", "IN"),
  },
  youtube: {
    apiKey: str("YOUTUBE_API_KEY"),
    /** Official Seedhe Maut channel. Enumerating uploads is far cheaper than search. */
    channelId: str("YOUTUBE_CHANNEL_ID"),
    /** Alternative to channelId, e.g. "@SeedheMaut". Resolved via channels.list. */
    channelHandle: str("YOUTUBE_CHANNEL_HANDLE"),
    /** Allow falling back to search.list (100 quota units per call). */
    allowSearchFallback: str("YOUTUBE_ALLOW_SEARCH", "false") === "true",
    maxSearchFallbacks: int("YOUTUBE_MAX_SEARCH_FALLBACKS", 0),
  },
  artistName: str("ARTIST_NAME", "Seedhe Maut"),
  cache: {
    /** Catalog TTL in seconds. */
    ttl: int("CACHE_TTL_SECONDS", 60 * 60 * 6),
  },
  rateLimit: {
    windowMs: int("RATE_LIMIT_WINDOW_MS", 60_000),
    max: int("RATE_LIMIT_MAX", 60),
  },
  /** Comma-separated list, or "*" to allow any origin. */
  allowedOrigins: str("ALLOWED_ORIGINS", ""),
} as const;

export const hasSpotify = (): boolean =>
  Boolean(env.spotify.clientId && env.spotify.clientSecret);

export const hasYouTube = (): boolean => Boolean(env.youtube.apiKey);

/** Human-readable list of what's missing, for the /api/health endpoint. */
export function missingConfig(): string[] {
  const missing: string[] = [];
  if (!env.spotify.clientId) missing.push("SPOTIFY_CLIENT_ID");
  if (!env.spotify.clientSecret) missing.push("SPOTIFY_CLIENT_SECRET");
  if (!env.youtube.apiKey) missing.push("YOUTUBE_API_KEY");
  return missing;
}
