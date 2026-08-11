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
  /** True while the player is fetching/buffering media. */
  buffering: boolean;
  /** The IFrame API never came up (blocked, offline, script failed). */
  failed: boolean;
  /** Autoplay was only allowed muted; unmute on the first user gesture. */
  autoMuted: boolean;
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
/**
 * IFrame API error codes.
 *   2   bad parameter
 *   5   HTML5 player error
 *   100 video removed / private
 *   101 embedding disabled by the owner
 *   150 same as 101 (owner disallows embedding on other sites)
 *
 * 101/150 are the common ones for official music videos: the API reports
 * `embeddable: true` yet the owner still blocks playback off youtube.com, and
 * that block can differ by referring domain — which is why a track can play on
 * localhost and fail on a deployed origin.
 */
export const YT_ERROR_TEXT: Record<number, string> = {
  2: "Invalid video parameter",
  5: "Player error",
  100: "Video is unavailable",
  101: "Owner disabled embedding",
  150: "Owner disabled embedding",
};

export function useYouTubePlayer(
  containerId: string,
  onEnded: () => void,
  onError?: (code: number) => void
): YouTubeApi {
  const playerRef = useRef<YTPlayer | null>(null);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const pendingRef = useRef<{ videoId: string; autoplay: boolean } | null>(null);
  /** True whenever playback *should* be running — independent of the last
   *  confirmed onStateChange, since a backgrounded tab can silently fail to
   *  reach PLAYING at all. */
  const wantPlayingRef = useRef(false);
  const heartbeatRef = useRef<{ time: number; ts: number; nudgedAt: number }>({
    time: 0,
    ts: 0,
    nudgedAt: 0,
  });

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [quality, setQuality] = useState("");
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [autoMuted, setAutoMuted] = useState(false);

  useEffect(() => {
    onEndedRef.current = onEnded;
    onErrorRef.current = onError;
  }, [onEnded, onError]);

  // Create the player once the API and the container element both exist.
  useEffect(() => {
    let cancelled = false;

    // If the API script is blocked or the network is down, the player never
    // reports ready — surface that instead of spinning forever.
    const readyTimer = setTimeout(() => {
      if (!cancelled && !playerRef.current) setFailed(true);
    }, 15000);

    loadApi().catch(() => {
      if (!cancelled) setFailed(true);
    }).then(() => {
      if (cancelled || !window.YT?.Player) {
        if (!cancelled) setFailed(true);
        return;
      }
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
              wantPlayingRef.current = false;
              setBuffering(false);
              setPlaying(false);
              onEndedRef.current();
            } else if (e.data === S.BUFFERING) {
              setBuffering(true);
            } else if (e.data === S.PLAYING) {
              setBuffering(false);
              setFailed(false);
              setPlaying(true);
              try {
                playerRef.current?.setPlaybackQuality("hd720");
              } catch {
                /* ignore */
              }
            } else if (e.data === S.PAUSED) {
              // A real user pause and an API-reported pause look the same
              // here; either way we should stop trying to resume it.
              wantPlayingRef.current = false;
              setBuffering(false);
              setPlaying(false);
            }
          },
          onError: (e: { data: number }) => {
            wantPlayingRef.current = false;
            setBuffering(false);
            setPlaying(false);
            onErrorRef.current?.(e.data);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      clearTimeout(readyTimer);
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

  /**
   * Background-tab stall guard.
   *
   * Reported bug: when the tab is backgrounded and a track auto-advances
   * (goNext on ENDED -> loadVideoById), Chrome sometimes leaves the new video
   * silent — no audio, currentTime frozen at 0 — without ever reporting an
   * error; onStateChange may not even reach PLAYING. Manually hitting pause
   * then play "unsticks" it, because playVideo() is an explicit API call
   * rather than an autoplay attempt, so it's allowed even without a fresh
   * user gesture.
   *
   * This does the same thing automatically: runs independent of the last
   * confirmed player state (via wantPlayingRef, not React's `playing`, since
   * a stuck load may never fire PLAYING at all) and re-issues playVideo() if
   * currentTime hasn't advanced within a grace window.
   */
  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p || !wantPlayingRef.current) return;

      let now = 0;
      try {
        now = p.getCurrentTime() || 0;
      } catch {
        return;
      }

      const hb = heartbeatRef.current;
      const nowMs = performance.now();
      const advancing = now > hb.time + 0.2;

      if (advancing) {
        heartbeatRef.current = { time: now, ts: nowMs, nudgedAt: hb.nudgedAt };
        return;
      }

      const stalledFor = nowMs - (hb.ts || nowMs);
      const sinceNudge = nowMs - hb.nudgedAt;
      // ~2s grace for legitimate buffering/seeking; don't re-nudge more than
      // once every 4s so this can't fight a real pause or spam the player.
      if (stalledFor > 2000 && sinceNudge > 4000) {
        heartbeatRef.current = { ...hb, nudgedAt: nowMs };
        try {
          p.playVideo();
        } catch {
          /* ignore */
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [ready]);

  // Extra safety net: some background-tab throttling delays the postMessage
  // command itself rather than the media pipeline. Re-assert on refocus.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const p = playerRef.current;
      if (p && wantPlayingRef.current) {
        try {
          p.playVideo();
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  /**
   * Browsers block autoplay with sound until the user interacts. Try it, and
   * if nothing is playing shortly after, mute and try again — muted autoplay
   * is permitted. `autoMuted` then tells the UI to unmute on first gesture.
   */
  const ensureAutoplay = useCallback(() => {
    window.setTimeout(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        if (!p.getCurrentTime || p.getCurrentTime() > 0) return;
        p.mute();
        setAutoMuted(true);
        p.playVideo();
      } catch {
        /* ignore */
      }
    }, 1200);
  }, []);

  const load = useCallback((videoId: string, autoplay: boolean) => {
    setCurrentTime(0);
    setDuration(0);
    setQuality("");
    wantPlayingRef.current = autoplay;
    heartbeatRef.current = { time: 0, ts: performance.now(), nudgedAt: 0 };
    if (autoplay) setBuffering(true);
    const p = playerRef.current;
    if (!p) {
      pendingRef.current = { videoId, autoplay };
      return;
    }
    const args = { videoId, suggestedQuality: "hd720" };
    if (autoplay) {
      p.loadVideoById(args);
      ensureAutoplay();
    } else p.cueVideoById(args);
  }, [ensureAutoplay]);

  return {
    ready,
    playing,
    currentTime,
    duration,
    quality,
    buffering,
    failed,
    autoMuted,
    load,
    play: useCallback(() => {
      wantPlayingRef.current = true;
      heartbeatRef.current = { time: 0, ts: performance.now(), nudgedAt: 0 };
      playerRef.current?.playVideo();
    }, []),
    pause: useCallback(() => {
      wantPlayingRef.current = false;
      playerRef.current?.pauseVideo();
    }, []),
    seek: useCallback((s: number) => playerRef.current?.seekTo(s, true), []),
    setVolume: useCallback((v: number) => playerRef.current?.setVolume(Math.round(v * 100)), []),
    setMuted: useCallback((m: boolean) => {
      const p = playerRef.current;
      if (!p) return;
      if (m) p.mute();
      else {
        p.unMute();
        setAutoMuted(false);
      }
    }, []),
  };
}
