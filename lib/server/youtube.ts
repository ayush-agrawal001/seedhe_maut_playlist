import "server-only";
import { env, hasYouTube } from "./env";
import { cached } from "./cache";
import { ConfigError, UpstreamError } from "./http";

const API = "https://www.googleapis.com/youtube/v3";

export interface YtVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  embeddable: boolean;
  /** Runtime in seconds (0 if unknown). */
  durationSec: number;
}

/** "PT4M13S" -> 253 */
export function parseIsoDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? "");
  if (!m) return 0;
  const [, d, h, mi, s] = m;
  return (
    Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(mi ?? 0) * 60 + Number(s ?? 0)
  );
}

/* ------------------------------- Fetching -------------------------------- */

async function ytFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!hasYouTube()) throw new ConfigError(["YOUTUBE_API_KEY"]);

  const qs = new URLSearchParams({ ...params, key: env.youtube.apiKey });
  const res = await fetch(`${API}${path}?${qs}`, { cache: "no-store" });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `GET ${path} -> ${res.status}.`;
    if (res.status === 403 && /quota/i.test(text)) {
      message += " YouTube API quota exceeded for today.";
    }
    throw new UpstreamError("youtube", res.status, `${message} ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/* ----------------------------- Title matching ---------------------------- */

const NOISE =
  /\b(official\s*(music\s*)?(video|audio|visualizer|lyric\s*video)?|music\s*video|lyric(s)?\s*video|visuali[sz]er|full\s*video|out\s*now|prod\.?\s*by[^|]*|dir\.?\s*by[^|]*|feat\.?|ft\.?|with\s+lyrics|4k|hd)\b/gi;

/** Reduce a video/track title to comparable words. */
export function normalizeTitle(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[|–—-]\s*seedhe\s*maut.*$/i, " ")
    .replace(NOISE, " ")
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const slug = (s: string): string => normalizeTitle(s).replace(/\s+/g, "");

function score(trackTitle: string, videoTitle: string): number {
  const a = slug(trackTitle);
  const b = slug(videoTitle);
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Short titles ("Red", "101", "MMM") are far too easy to match by prefix or
  // substring — "red" would happily claim "Redemption". Demand an exact hit.
  if (a.length < 5) return 0;

  if (b.startsWith(a) || a.startsWith(b)) return 0.9;
  if (b.includes(a)) return 0.8;

  const at = new Set(normalizeTitle(trackTitle).split(" ").filter(Boolean));
  const bt = new Set(normalizeTitle(videoTitle).split(" ").filter(Boolean));
  if (!at.size) return 0;
  let hit = 0;
  for (const w of at) if (bt.has(w)) hit++;
  return (hit / at.size) * 0.7;
}

/* ------------------------------- Channel --------------------------------- */

interface ChannelsResponse {
  items?: Array<{ id: string; contentDetails: { relatedPlaylists: { uploads: string } } }>;
}

/**
 * Finds the uploads playlist, preferring the cheapest route:
 *   1. YOUTUBE_CHANNEL_ID   (1 unit)
 *   2. YOUTUBE_CHANNEL_HANDLE e.g. "@SeedheMaut" (1 unit)
 *   3. search.list by name  (100 units — last resort, often restricted)
 */
async function resolveUploadsPlaylist(): Promise<string> {
  const { channelId, channelHandle } = env.youtube;

  if (channelId) {
    const data = await ytFetch<ChannelsResponse>("/channels", {
      part: "contentDetails",
      id: channelId,
    });
    const uploads = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (uploads) return uploads;
    throw new UpstreamError("youtube", 404, `No channel found for id "${channelId}".`);
  }

  if (channelHandle) {
    const handle = channelHandle.startsWith("@") ? channelHandle : `@${channelHandle}`;
    const data = await ytFetch<ChannelsResponse>("/channels", {
      part: "contentDetails",
      forHandle: handle,
    });
    const uploads = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (uploads) return uploads;
    throw new UpstreamError("youtube", 404, `No channel found for handle "${handle}".`);
  }

  const data = await ytFetch<{ items?: Array<{ id: { channelId: string } }> }>("/search", {
    part: "snippet",
    type: "channel",
    q: env.artistName,
    maxResults: "1",
  });
  const found = data.items?.[0]?.id?.channelId;
  if (!found) {
    throw new UpstreamError(
      "youtube",
      404,
      `Channel for "${env.artistName}" not found. Set YOUTUBE_CHANNEL_ID or YOUTUBE_CHANNEL_HANDLE.`
    );
  }

  const ch = await ytFetch<ChannelsResponse>("/channels", { part: "contentDetails", id: found });
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new UpstreamError("youtube", 404, `No uploads playlist for channel ${found}.`);
  return uploads;
}

/**
 * All uploads from the official channel.
 * playlistItems.list costs 1 quota unit per page of 50 — vastly cheaper than
 * search.list (100 units per call) for building a title index.
 */
export async function getChannelVideos(): Promise<YtVideo[]> {
  return cached("youtube:uploads", env.cache.ttl, async () => {
    const playlistId = await resolveUploadsPlaylist();

    const items: Array<{ videoId: string; title: string; publishedAt: string }> = [];
    let pageToken = "";

    for (let page = 0; page < 20; page++) {
      const data = await ytFetch<{
        items: Array<{
          snippet: { title: string; publishedAt: string; resourceId: { videoId: string } };
        }>;
        nextPageToken?: string;
      }>("/playlistItems", {
        part: "snippet",
        playlistId,
        maxResults: "50",
        ...(pageToken ? { pageToken } : {}),
      });

      for (const it of data.items ?? []) {
        const vid = it.snippet?.resourceId?.videoId;
        if (vid) {
          items.push({
            videoId: vid,
            title: it.snippet.title,
            publishedAt: it.snippet.publishedAt,
          });
        }
      }
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }

    // Confirm embeddability + fetch runtime, in batches of 50 (1 unit each).
    // We only ever play through the official IFrame player, so non-embeddable
    // videos are unusable.
    const meta = new Map<string, { embeddable: boolean; durationSec: number }>();
    for (let i = 0; i < items.length; i += 50) {
      const ids = items.slice(i, i + 50).map((v) => v.videoId).join(",");
      const data = await ytFetch<{
        items: Array<{
          id: string;
          status: { embeddable: boolean };
          contentDetails: { duration: string };
        }>;
      }>("/videos", { part: "status,contentDetails", id: ids });
      for (const v of data.items ?? []) {
        meta.set(v.id, {
          embeddable: Boolean(v.status?.embeddable),
          durationSec: parseIsoDuration(v.contentDetails?.duration ?? ""),
        });
      }
    }

    return items.map((v) => ({
      ...v,
      embeddable: meta.get(v.videoId)?.embeddable ?? false,
      durationSec: meta.get(v.videoId)?.durationSec ?? 0,
    }));
  });
}

/** Best matching official video for a track title, or null. */
export function matchVideo(
  trackTitle: string,
  videos: YtVideo[],
  minScore = 0.78
): YtVideo | null {
  let best: YtVideo | null = null;
  let bestScore = 0;

  for (const v of videos) {
    const s = score(trackTitle, v.title);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return bestScore >= minScore ? best : null;
}
