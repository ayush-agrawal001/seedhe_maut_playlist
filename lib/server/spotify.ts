import "server-only";
import { env, hasSpotify } from "./env";
import { cached, cacheGet, cacheSet } from "./cache";
import { ConfigError, UpstreamError } from "./http";

const ACCOUNTS = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";
const TOKEN_KEY = "spotify:token";

/* ----------------------------- Upstream types ---------------------------- */

interface SpImage {
  url: string;
  width: number | null;
  height: number | null;
}
interface SpArtistRef {
  id: string;
  name: string;
}
interface SpAlbum {
  id: string;
  name: string;
  album_type: string;
  release_date: string;
  total_tracks: number;
  images: SpImage[];
  external_urls: { spotify: string };
  artists: SpArtistRef[];
}
interface SpTrack {
  id: string;
  name: string;
  duration_ms: number;
  explicit: boolean;
  track_number: number;
  artists: SpArtistRef[];
  external_urls: { spotify: string };
  uri: string;
}
interface SpAlbumFull extends SpAlbum {
  tracks: { items: SpTrack[] };
  popularity?: number;
}

export interface SpotifyCatalog {
  artistId: string;
  artistName: string;
  albums: Array<{
    id: string;
    name: string;
    year: number;
    cover: string;
    coverSmall: string;
    url: string;
    tracks: Array<{
      id: string;
      name: string;
      durationMs: number;
      explicit: boolean;
      artists: string[];
      url: string;
      uri: string;
    }>;
  }>;
}

/* -------------------------------- Auth ----------------------------------- */

/**
 * Client Credentials flow. The secret stays on the server; the token is cached
 * in memory until shortly before it expires.
 */
async function getToken(): Promise<string> {
  if (!hasSpotify()) {
    throw new ConfigError(
      [
        !env.spotify.clientId && "SPOTIFY_CLIENT_ID",
        !env.spotify.clientSecret && "SPOTIFY_CLIENT_SECRET",
      ].filter(Boolean) as string[]
    );
  }

  const hit = cacheGet<string>(TOKEN_KEY);
  if (hit) return hit;

  const basic = Buffer.from(
    `${env.spotify.clientId}:${env.spotify.clientSecret}`
  ).toString("base64");

  const res = await fetch(ACCOUNTS, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new UpstreamError(
      "spotify",
      res.status,
      `Token request failed (${res.status}). Check SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET. ${text.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  // Refresh a minute early to avoid racing expiry.
  cacheSet(TOKEN_KEY, data.access_token, Math.max(30, data.expires_in - 60));
  return data.access_token;
}

/* ------------------------------- Fetching -------------------------------- */

async function spFetch<T>(path: string, attempt = 0): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 429 && attempt < 2) {
    const wait = Number(res.headers.get("retry-after") ?? 1);
    await new Promise((r) => setTimeout(r, Math.min(wait, 5) * 1000));
    return spFetch<T>(path, attempt + 1);
  }
  if (res.status === 401 && attempt < 1) {
    cacheSet(TOKEN_KEY, "", 0); // force refresh
    return spFetch<T>(path, attempt + 1);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new UpstreamError("spotify", res.status, `GET ${path} -> ${res.status}. ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

const pickImage = (images: SpImage[], want: "big" | "small"): string => {
  if (!images?.length) return "";
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return (want === "big" ? sorted[0] : sorted[sorted.length - 1])?.url ?? "";
};

const yearOf = (releaseDate: string): number =>
  Number.parseInt(releaseDate?.slice(0, 4) ?? "0", 10) || 0;

/* ------------------------------- Public API ------------------------------ */

export async function resolveArtistId(): Promise<{ id: string; name: string }> {
  if (env.spotify.artistId) {
    const a = await spFetch<{ id: string; name: string }>(`/artists/${env.spotify.artistId}`);
    return { id: a.id, name: a.name };
  }
  const q = encodeURIComponent(env.artistName);
  const data = await spFetch<{ artists: { items: SpArtistRef[] } }>(
    `/search?q=${q}&type=artist&limit=1`
  );
  const hit = data.artists.items[0];
  if (!hit) throw new UpstreamError("spotify", 404, `Artist "${env.artistName}" not found.`);
  return { id: hit.id, name: hit.name };
}

/** Full artist catalog: albums + singles, each with its track list. */
export async function getSpotifyCatalog(): Promise<SpotifyCatalog> {
  return cached("spotify:catalog", env.cache.ttl, async () => {
    const artist = await resolveArtistId();

    // 1. Enumerate albums + singles.
    //
    // NOTE: apps in Spotify's development mode reject an explicit `limit`
    // ("400 Invalid limit") and force a small page size, so we omit it and
    // walk `offset` ourselves rather than following the `next` URL (which
    // carries a `limit` and would 400).
    const albums: SpAlbum[] = [];
    const seen = new Set<string>();
    const base = `/artists/${artist.id}/albums?include_groups=album,single&market=${env.spotify.market}`;

    let offset = 0;
    let total = Infinity;
    for (let page = 0; page < 40 && offset < total; page++) {
      const res: { items: SpAlbum[]; total: number } = await spFetch(
        `${base}&offset=${offset}`
      );
      total = res.total ?? 0;
      const items = res.items ?? [];
      if (!items.length) break;

      for (const a of items) {
        if (!seen.has(a.id)) {
          seen.add(a.id);
          albums.push(a);
        }
      }
      offset += items.length;
    }

    // 2. De-duplicate regional re-releases by normalized name, keep earliest.
    const byName = new Map<string, SpAlbum>();
    for (const a of albums) {
      const key = a.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const prev = byName.get(key);
      if (!prev || yearOf(a.release_date) < yearOf(prev.release_date)) byName.set(key, a);
    }
    const unique = [...byName.values()];

    // 3. Fetch each album's tracks.
    //
    // The batch endpoint (/albums?ids=…) is 403 for development-mode apps, so
    // albums are fetched one at a time. The 6h catalogue cache keeps this to a
    // single burst per cold start.
    const full: SpAlbumFull[] = [];
    for (const a of unique.slice(0, 60)) {
      try {
        full.push(
          await spFetch<SpAlbumFull>(`/albums/${a.id}?market=${env.spotify.market}`)
        );
      } catch (e) {
        // One unavailable album shouldn't sink the whole catalogue.
        console.warn(`[spotify] album ${a.id} failed:`, (e as Error).message);
      }
    }

    return {
      artistId: artist.id,
      artistName: artist.name,
      albums: full.map((a) => ({
        id: a.id,
        name: a.name,
        year: yearOf(a.release_date),
        cover: pickImage(a.images, "big"),
        coverSmall: pickImage(a.images, "small"),
        url: a.external_urls?.spotify ?? "",
        tracks: (a.tracks?.items ?? [])
          // Keep only tracks the artist actually performs on.
          .filter((t) => t.artists.some((ar) => ar.id === artist.id))
          .map((t) => ({
            id: t.id,
            name: t.name,
            durationMs: t.duration_ms,
            explicit: t.explicit,
            artists: t.artists.map((ar) => ar.name),
            url: t.external_urls?.spotify ?? "",
            uri: t.uri,
          })),
      })),
    };
  });
}
