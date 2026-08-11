import "server-only";
import { env, hasSpotify, hasYouTube, missingConfig } from "./env";
import { cached } from "./cache";
import { ConfigError, UpstreamError } from "./http";
import { getSpotifyCatalog } from "./spotify";
import { getChannelVideos, matchVideo, type YtVideo } from "./youtube";
import { pickLocalCover } from "./covers";
import type { ApiAlbum, ApiTrack, CatalogMeta } from "@/lib/types";

export interface Catalog {
  meta: CatalogMeta;
  tracks: ApiTrack[];
  albums: ApiAlbum[];
}

/** Below this many playable tracks, pull in YouTube channel songs as a safety net. */
const MIN_PLAYABLE = 12;

/** Retry window when one upstream is down (seconds). */
const DEGRADED_TTL = 180;

const ytUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/**
 * Titles that are clearly not songs on an artist channel.
 *
 * Built from what actually leaked through: tour vlogs, the "10 YEARS OF"
 * anniversary cut, a 9-minute "philum", and a festival set.
 */
const NOT_A_SONG = new RegExp(
  [
    // promo / announcements
    "trailer", "teaser", "snippet", "promo", "announce\\w*", "out\\s+now",
    "pre[-\\s]?save", "coming\\s+soon", "album\\s+out",
    // anniversaries and retrospectives
    "\\d+\\s*years?\\s+of", "anniversar\\w*", "throwback", "rewind",
    // long-form / non-musical
    "vlog", "interview", "podcast", "episode", "ep\\.?\\s*\\d",
    "behind\\s+the\\s+scenes", "bts", "making\\s+of",
    "documentar\\w*", "docu", "philum", "short\\s*film", "recap", "reaction",
    // touring and live
    "tour", "weekender", "concert", "full\\s+set", "highlights",
    "live\\s+(at|in|from|performance)", "performance\\s+at", "festival",
    "showcase", "sound\\s*check",
    // misc channel content
    "q\\s*&\\s*a", "shorts?", "merch", "giveaway", "unboxing",
    "compilation", "mashup", "medley", "full\\s+album",
  ].map((w) => `\\b${w}\\b`).join("|"),
  "i"
);

/**
 * Heuristic song filter for the YouTube-only fallback.
 * Songs are typically 1.5–10 minutes; shorter is a teaser, longer is usually a
 * set, documentary or compilation.
 */
function looksLikeSong(title: string, durationSec: number): boolean {
  if (NOT_A_SONG.test(title)) return false;

  // An unknown runtime means a Short or a live stream, neither of which is a
  // track we can present honestly.
  if (durationSec <= 0) return false;
  if (durationSec < 80 || durationSec > 600) return false;

  // All-caps sloganeering ("STADIUM MAIN BHUSSI BHARDI!") is promo, not a
  // track. Channel handles are stripped first — "@SeedheMaut" was supplying
  // the lowercase that let those titles slip past.
  const letters = title.replace(/@\S+/g, "").replace(/[^A-Za-z]/g, "");
  if (letters.length > 12 && letters === letters.toUpperCase()) return false;

  return true;
}

/** Comparison key for de-duplication: "Dikkat" and "DIKKAT'" are one song. */
function songKey(title: string): string {
  return cleanYtTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F]+/g, "");
}

/** Strip "Seedhe Maut - ", "| Official Video" etc. from a raw YouTube title. */
function cleanYtTitle(title: string): string {
  const cleaned = title
    // drop a leading "Seedhe Maut - " / "Seedhe Maut, X - "
    .replace(/^\s*seedhe\s*maut\s*[^-–—|:]*[-–—|:]\s*/i, "")
    // everything after the first | or || is channel/credit noise
    .replace(/\s*\|\|?.*$/, "")
    // trailing credits: "Taakat - Seedhe Maut x DJ Sa ft. Lil Bhavi"
    .replace(/\s*[-–—]\s*seedhe\s*maut\b.*$/i, "")
    .replace(/\s*\b(feat\.?|ft\.)\s.*$/i, "")
    // "(Official Lyric Video)" / "[Official Audio]" anywhere
    .replace(
      /\s*[([]\s*(official\s*)?(music\s*|lyric[s]?\s*)?(video|audio|visuali[sz]er)\s*[)\]]/gi,
      " "
    )
    // stray wrapping quotes
    .replace(/^['"“”‘’]+|['"“”‘’]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || title;
}

/**
 * Builds the unified catalog:
 *   Spotify -> metadata, album grouping, official artwork
 *   YouTube -> official videoId used by the IFrame player for playback
 *
 * Neither service is required to be present; whichever is configured is used.
 */
export async function getCatalog(): Promise<Catalog> {
  if (!hasSpotify() && !hasYouTube()) throw new ConfigError(missingConfig());

  // A degraded catalogue (one source down) is cached only briefly, so the
  // moment the failing service recovers the full catalogue is picked up
  // instead of being stuck behind the long TTL.
  const ttlFor = (c: Catalog) => (c.meta.degraded?.length ? DEGRADED_TTL : env.cache.ttl);

  return cached("catalog:v1", ttlFor, async () => {
    const sources: string[] = [];
    const failures: string[] = [];

    const [spotify, videos] = await Promise.all([
      hasSpotify()
        ? getSpotifyCatalog()
            .then((c) => {
              sources.push("spotify");
              return c;
            })
            // Spotify down / 403 / quota -> fall back to a YouTube-only catalog
            // rather than failing the whole request.
            .catch((e) => {
              const msg = (e as Error).message;
              console.warn("[catalog] Spotify unavailable:", msg);
              failures.push(`spotify: ${msg}`);
              return null;
            })
        : Promise.resolve(null),
      hasYouTube()
        ? getChannelVideos()
            .then((v) => {
              sources.push("youtube");
              return v;
            })
            // YouTube is optional enrichment — a quota error shouldn't kill the catalog.
            .catch((e) => {
              const msg = (e as Error).message;
              console.warn("[catalog] YouTube unavailable:", msg);
              failures.push(`youtube: ${msg}`);
              return [] as YtVideo[];
            })
        : Promise.resolve([] as YtVideo[]),
    ]);

    const tracks: ApiTrack[] = [];
    const albums: ApiAlbum[] = [];
    const usedVideoIds = new Set<string>();

    if (spotify) {
      for (const album of spotify.albums) {
        if (!album.tracks.length) continue;

        albums.push({
          id: album.id,
          name: album.name,
          year: album.year,
          cover: album.cover,
          trackCount: album.tracks.length,
          spotifyUrl: album.url || null,
        });

        for (const t of album.tracks) {
          const video = matchVideo(t.name, videos);
          // Don't map two different songs onto the same video.
          const yt = video && !usedVideoIds.has(video.videoId) ? video : null;
          if (yt) usedVideoIds.add(yt.videoId);

          tracks.push({
            id: `sp:${t.id}`,
            title: t.name,
            artists: t.artists.join(", "),
            album: album.name,
            albumId: album.id,
            year: album.year,
            durationMs: t.durationMs,
            cover: album.cover,
            coverSmall: album.coverSmall || album.cover,
            explicit: t.explicit,
            popularity: null,
            spotify: { id: t.id, url: t.url, uri: t.uri },
            youtube: yt
              ? { videoId: yt.videoId, url: ytUrl(yt.videoId), embeddable: yt.embeddable }
              : null,
          });
        }
      }
    }

    // YouTube safety net. Used when Spotify is unavailable, and also when
    // Spotify worked but almost nothing matched a video — without this the
    // playable pool could collapse and the player would have nothing to play.
    const spotifyPlayable = tracks.filter((t) => t.youtube?.embeddable).length;
    const needsFallback = !spotify || spotifyPlayable < MIN_PLAYABLE;

    if (needsFallback && videos.length) {
      if (spotify) {
        failures.push(
          `youtube-match: only ${spotifyPlayable} Spotify tracks matched a video; added channel songs as fallback`
        );
      }
      // Most songs exist twice on the channel (official video + lyric/audio
      // cut). Keep the longest upload of each and drop the rest.
      const bestPerSong = new Map<string, YtVideo>();
      for (const v of videos) {
        if (!v.embeddable) continue;
        if (usedVideoIds.has(v.videoId)) continue; // already backing a Spotify track
        // A hand-curated playlist (YOUTUBE_PLAYLIST_ID) is trusted as-is; the
        // NOT_A_SONG/duration heuristics exist only for a raw uploads scan.
        if (!v.curated && !looksLikeSong(v.title, v.durationSec)) continue;
        const key = songKey(v.title);
        if (!key) continue;
        const prev = bestPerSong.get(key);
        if (!prev || v.durationSec > prev.durationSec) bestPerSong.set(key, v);
      }

      for (const v of bestPerSong.values()) {
        usedVideoIds.add(v.videoId);

        // Artwork must actually belong to this song. A local sleeve is only
        // used when the title names its album; otherwise we fall back to the
        // video's own thumbnail, which is correct by construction. Guessing a
        // sleeve looks nicer but pairs songs with the wrong cover.
        const art = pickLocalCover(v.title, v.videoId);
        const cover = art.exact
          ? art.cover
          : `https://i.ytimg.com/vi/${v.videoId}/maxresdefault.jpg`;
        const coverSmall = art.exact
          ? art.cover
          : `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`;

        tracks.push({
          id: `yt:${v.videoId}`,
          title: cleanYtTitle(v.title),
          artists: env.artistName,
          album: art.exact ? art.album : "Single",
          albumId: "youtube",
          year: Number.parseInt(v.publishedAt.slice(0, 4), 10) || 0,
          durationMs: v.durationSec * 1000,
          cover,
          coverSmall,
          explicit: false,
          popularity: null,
          spotify: null,
          youtube: { videoId: v.videoId, url: ytUrl(v.videoId), embeddable: true },
        });
      }
      const ytCount = tracks.filter((t) => t.albumId === "youtube").length;
      if (ytCount) {
        albums.push({
          id: "youtube",
          name: "From YouTube",
          year: 0,
          cover: tracks.find((t) => t.albumId === "youtube")?.cover ?? "",
          trackCount: ytCount,
          spotifyUrl: null,
        });
      }
    }

    // Both upstreams failed — throw so nothing empty gets cached for the TTL.
    if (!tracks.length && failures.length) {
      throw new UpstreamError(
        failures[0]!.startsWith("spotify") ? "spotify" : "youtube",
        502,
        `No catalogue could be built. ${failures.join(" | ")}`
      );
    }

    albums.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));

    const meta: CatalogMeta = {
      artist: spotify?.artistName ?? env.artistName,
      artistId: spotify?.artistId ?? null,
      totalTracks: tracks.length,
      totalAlbums: albums.length,
      playableOnYouTube: tracks.filter((t) => t.youtube?.embeddable).length,
      fetchedAt: new Date().toISOString(),
      sources,
      degraded: failures.length ? failures : undefined,
    };

    return { meta, tracks, albums };
  });
}

/** Tracks that can actually be played through the official IFrame player. */
export const playableTracks = (c: Catalog): ApiTrack[] =>
  c.tracks.filter((t) => t.youtube?.embeddable);

/**
 * Picks a random track, avoiding anything in `exclude` (the recently played
 * ids) so the same song never repeats back-to-back. If every candidate is
 * excluded, only the most recent one is avoided.
 */
export function pickRandom(pool: ApiTrack[], exclude: string[]): ApiTrack | null {
  if (!pool.length) return null;
  if (pool.length === 1) return pool[0]!;

  const blocked = new Set(exclude);
  let candidates = pool.filter((t) => !blocked.has(t.id));

  if (!candidates.length) {
    const last = exclude[0];
    candidates = pool.filter((t) => t.id !== last);
    if (!candidates.length) candidates = pool;
  }
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}
