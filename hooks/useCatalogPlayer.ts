"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, fetchRandom, fetchTracks } from "@/lib/api";
import type { ApiTrack } from "@/lib/types";
import {
  MIN_GOOD_QUALITY,
  QUALITY_LABEL,
  QUALITY_ORDER,
  YT_ERROR_TEXT,
  useYouTubePlayer,
} from "./useYouTubePlayer";

/** How many recent tracks to avoid when drawing a random song. */
const RECENT_MEMORY = 10;

export interface CatalogPlayerApi {
  tracks: ApiTrack[];
  current: ApiTrack | null;
  loading: boolean;
  error: string | null;
  playing: boolean;
  curTime: number;
  dur: number;
  volume: number;
  muted: boolean;
  ready: boolean;
  /** Current video quality id ("" until known). */
  quality: string;
  /** Human label, e.g. "720p". */
  qualityLabel: string;
  /** True when playback dropped below 480p. */
  lowQuality: boolean;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  playTrack: (t: ApiTrack) => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  reload: () => void;
}

export function useCatalogPlayer(playerContainerId: string): CatalogPlayerApi {
  const [tracks, setTracks] = useState<ApiTrack[]>([]);
  const [current, setCurrent] = useState<ApiTrack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(0.85);
  const [muted, setMuted] = useState(false);

  /** Most-recent-first history, used to avoid repeats. */
  const recentRef = useRef<string[]>([]);
  const historyRef = useRef<ApiTrack[]>([]);
  /** Videos the embed refused; kept out of future draws for this session. */
  const blockedRef = useRef<Set<string>>(new Set());
  const consecutiveErrorsRef = useRef(0);
  const currentRef = useRef<ApiTrack | null>(null);

  const remember = (t: ApiTrack) => {
    recentRef.current = [t.id, ...recentRef.current.filter((id) => id !== t.id)].slice(
      0,
      RECENT_MEMORY
    );
  };

  const goNext = useCallback(() => {
    void (async () => {
      try {
        // Ask the server to skip anything this session already found unplayable.
        const avoid = [...recentRef.current, ...blockedRef.current];
        const { track } = await fetchRandom(avoid);
        remember(track);
        historyRef.current = [track, ...historyRef.current].slice(0, 50);
        currentRef.current = track;
        setCurrent(track);
        if (track.youtube) yt.load(track.youtube.videoId, true);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not load the next song.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * A video the embed refuses (commonly 101/150 — owner blocks off-site
   * playback, which can vary by domain). Remember it and move on rather than
   * stranding the user on a dead track.
   */
  const handlePlaybackError = useCallback((code: number) => {
    const t = currentRef.current;
    if (t) blockedRef.current.add(t.id);
    consecutiveErrorsRef.current += 1;

    if (consecutiveErrorsRef.current >= 6) {
      setError(
        `Several videos in a row could not be embedded (${YT_ERROR_TEXT[code] ?? `error ${code}`}). ` +
          "This is usually a YouTube restriction on this domain."
      );
      return;
    }
    setError(null);
    goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const yt = useYouTubePlayer(playerContainerId, goNext, handlePlaybackError);

  /* ------------------------------ initial load --------------------------- */
  const load = useCallback(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await fetchTracks(ac.signal);
        setTracks(data.tracks);
        if (!data.tracks.length) {
          setError("No playable songs were found for this artist.");
          return;
        }
        const { track } = await fetchRandom([], ac.signal);
        remember(track);
        historyRef.current = [track];

        // Preload the artwork so the first frame is complete, not a black flash.
        await new Promise<void>((resolve) => {
          if (!track.cover) return resolve();
          const img = new Image();
          const done = () => resolve();
          img.onload = done;
          img.onerror = done;
          img.src = track.cover;
          setTimeout(done, 6000); // never block the UI on a slow image
        });

        currentRef.current = track;
        setCurrent(track);
        // Cue (not autoplay) — browsers block sound before a user gesture.
        if (track.youtube) yt.load(track.youtube.videoId, false);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(
          e instanceof ApiError
            ? e.code === "not_configured"
              ? "Backend not configured — add your Spotify / YouTube keys to .env.local"
              : e.message
            : "Could not reach the server."
        );
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => load(), [load]);

  /* --------------------------------- controls ---------------------------- */
  const playTrack = useCallback(
    (t: ApiTrack) => {
      remember(t);
      historyRef.current = [t, ...historyRef.current].slice(0, 50);
      currentRef.current = t;
      setCurrent(t);
      if (t.youtube) yt.load(t.youtube.videoId, true);
    },
    [yt]
  );

  const prev = useCallback(() => {
    if (yt.currentTime > 3) {
      yt.seek(0);
      return;
    }
    const [, previous] = historyRef.current;
    if (previous) {
      historyRef.current = historyRef.current.slice(1);
      setCurrent(previous);
      if (previous.youtube) yt.load(previous.youtube.videoId, true);
    } else {
      yt.seek(0);
    }
  }, [yt]);

  const setVolume = useCallback(
    (v: number) => {
      const c = Math.max(0, Math.min(1, v));
      setVolumeState(c);
      yt.setVolume(c);
      if (c > 0 && muted) {
        setMuted(false);
        yt.setMuted(false);
      }
    },
    [yt, muted]
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      yt.setMuted(!m);
      return !m;
    });
  }, [yt]);

  // A successful play means the run of failures is over.
  useEffect(() => {
    if (yt.playing) consecutiveErrorsRef.current = 0;
  }, [yt.playing]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        yt.playing ? yt.pause() : yt.play();
      } else if (e.code === "ArrowRight") goNext();
      else if (e.code === "ArrowLeft") prev();
      else if (e.code === "ArrowUp") setVolume(volume + 0.05);
      else if (e.code === "ArrowDown") setVolume(volume - 0.05);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [yt, goNext, prev, setVolume, volume]);

  return {
    tracks,
    current,
    loading,
    error,
    playing: yt.playing,
    curTime: yt.currentTime,
    dur: yt.duration,
    volume,
    muted,
    ready: yt.ready,
    quality: yt.quality,
    qualityLabel: QUALITY_LABEL[yt.quality] ?? "",
    lowQuality:
      Boolean(yt.quality) &&
      QUALITY_ORDER.indexOf(yt.quality as (typeof QUALITY_ORDER)[number]) <
        QUALITY_ORDER.indexOf(MIN_GOOD_QUALITY),
    toggle: () => (yt.playing ? yt.pause() : yt.play()),
    next: goNext,
    prev,
    playTrack,
    seek: yt.seek,
    setVolume,
    toggleMute,
    reload: load,
  };
}
