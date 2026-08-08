"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the official IFrame Player API. */
interface YTLoadArgs {
  videoId: string;
  suggestedQuality?: string;
}
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  loadVideoById(args: YTLoadArgs): void;
  cueVideoById(args: YTLoadArgs): void;
  setPlaybackQuality(q: string): void;
  getPlaybackQuality(): string;
  getAvailableQualityLevels(): string[];
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(v: number): void;
  mute(): void;
  unMute(): void;
  destroy(): void;
}
declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, opts: unknown) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SRC = "https://www.youtube.com/iframe_api";
let apiPromise: Promise<void> | null = null;

/** Loads the IFrame API script once per page. */
function loadApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.querySelector(`script[src="${SRC}"]`)) {
      const s = document.createElement("script");
      s.src = SRC;
      s.async = true;
      document.head.appendChild(s);
    }
  });
  return apiPromise;
}

/** YouTube quality ids, worst -> best. */
export const QUALITY_ORDER = [
  "tiny", "small", "medium", "large", "hd720", "hd1080", "hd1440", "hd2160", "highres",
] as const;

/** Human labels for the quality ids we surface. */
export const QUALITY_LABEL: Record<string, string> = {
  tiny: "144p", small: "240p", medium: "360p", large: "480p",
  hd720: "720p", hd1080: "1080p", hd1440: "1440p", hd2160: "4K", highres: "HD",
};

/** Anything below this is treated as a poor-connection experience. */
export const MIN_GOOD_QUALITY = "large"; // 480p

export interface YouTubeApi {
  ready: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  /** Current playback quality id, or "" if unknown yet. */
  quality: string;
  load: (videoId: string, autoplay: boolean) => void;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  setVolume: (v0to1: number) => void;
  setMuted: (m: boolean) => void;
}

/**
 * Drives playback through the official YouTube IFrame player.
 *
 * The player element must stay visible — the YouTube API Terms of Service do
 * not permit hiding or obscuring it, or playing audio without the video.
 */
export function useYouTubePlayer(
  containerId: string,
  onEnded: () => void
): YouTubeApi {
  const playerRef = useRef<YTPlayer | null>(null);
  const onEndedRef = useRef(onEnded);
  const pendingRef = useRef<{ videoId: string; autoplay: boolean } | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [quality, setQuality] = useState("");

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // Create the player once the API and the container element both exist.
  useEffect(() => {
    let cancelled = false;

    loadApi().then(() => {
      if (cancelled || !window.YT?.Player) return;
      const el = document.getElementById(containerId);
      if (!el) return;

      playerRef.current = new window.YT.Player(el, {
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          autoplay: 0,
          // No native chrome — our own pill drives playback, and the
          // background mode needs a clean frame.
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          origin: typeof location !== "undefined" ? location.origin : undefined,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            setReady(true);
            // Ask for HD. YouTube may still step down on a weak connection,
            // which is what the quality poll below reports back to the UI.
            try {
              playerRef.current?.setPlaybackQuality("hd720");
            } catch {
              /* older players ignore this */
            }
            const p = pendingRef.current;
            if (p) {
              pendingRef.current = null;
              const args = { videoId: p.videoId, suggestedQuality: "hd720" };
              if (p.autoplay) playerRef.current?.loadVideoById(args);
              else playerRef.current?.cueVideoById(args);
            }
          },
          onStateChange: (e: { data: number }) => {
            const S = window.YT!.PlayerState;
            if (e.data === S.ENDED) {
              setPlaying(false);
              onEndedRef.current();
            } else if (e.data === S.PLAYING) {
              setPlaying(true);
              try {
                playerRef.current?.setPlaybackQuality("hd720");
              } catch {
                /* ignore */
              }
            } else if (e.data === S.PAUSED) setPlaying(false);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [containerId]);

  // Poll progress while playing.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      setCurrentTime(p.getCurrentTime() || 0);
      setDuration(p.getDuration() || 0);
      try {
        const q = p.getPlaybackQuality?.();
        if (q && q !== "unknown") setQuality(q);
      } catch {
        /* ignore */
      }
    }, 500);
    return () => clearInterval(t);
  }, [playing]);

  const load = useCallback((videoId: string, autoplay: boolean) => {
    setCurrentTime(0);
    setDuration(0);
    setQuality("");
    const p = playerRef.current;
    if (!p) {
      pendingRef.current = { videoId, autoplay };
      return;
    }
    const args = { videoId, suggestedQuality: "hd720" };
    if (autoplay) p.loadVideoById(args);
    else p.cueVideoById(args);
  }, []);

  return {
    ready,
    playing,
    currentTime,
    duration,
    quality,
    load,
    play: useCallback(() => playerRef.current?.playVideo(), []),
    pause: useCallback(() => playerRef.current?.pauseVideo(), []),
    seek: useCallback((s: number) => playerRef.current?.seekTo(s, true), []),
    setVolume: useCallback((v: number) => playerRef.current?.setVolume(Math.round(v * 100)), []),
    setMuted: useCallback((m: boolean) => {
      const p = playerRef.current;
      if (!p) return;
      if (m) p.mute();
      else p.unMute();
    }, []),
  };
}
