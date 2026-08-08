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
  /** True while a new track is being fetched or is still buffering. */
  busy: boolean;
  /** Blocks the whole app — the catalogue or the player never came up. */
  fatalError: string | null;
  /** The browser reports no network. */
  offline: boolean;
  /** A retry is in flight. */
  retrying: boolean;
  /** Autoplay started muted; the UI should offer to unmute. */
  autoMuted: boolean;
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
  const [switching, setSwitching] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);

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
      setSwitching(true);
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
      } finally {
        setSwitching(false);
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
    setFatalError(null);

    (async () => {
      const attempts = 3;
      for (let i = 0; i < attempts; i++) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setOffline(true);
          setFatalError("No network connection.");
          setLoading(false);
          return;
        }
        try {
          const data = await fetchTracks(ac.signal);
          if (!data.tracks.length) {
            setFatalError("The catalogue came back empty — no playable songs were found.");
            setLoading(false);
            return;
          }
          setTracks(data.tracks);

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
            setTimeout(done, 6000);
          });

          currentRef.current = track;
          setCurrent(track);
          // Autoplay straight away; the player falls back to muted if the
          // browser blocks sound before any interaction.
          if (track.youtube) yt.load(track.youtube.videoId, true);

          setOffline(false);
          setFatalError(null);
          setLoading(false);
          setRetrying(false);
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;

          const last = i === attempts - 1;
          if (!last) {
            // Transient: back off and try again before bothering the user.
            await new Promise((r) => setTimeout(r, 700 * (i + 1)));
            continue;
          }
          setFatalError(
            e instanceof ApiError
              ? e.code === "not_configured"
                ? "The server is missing its Spotify / YouTube credentials."
                : e.message
              : "Could not reach the server."
          );
          setLoading(false);
          setRetrying(false);
        }
      }
    })();

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Retry the initial load, surfacing that a retry is in flight. */
  const retry = useCallback(() => {
    setRetrying(true);
    load();
  }, [load]);

  // Come back automatically when the connection returns.
  useEffect(() => {
    const onOnline = () => {
      setOffline(false);
      if (fatalError) retry();
    };
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [fatalError, retry]);

  // The player itself failing is just as fatal as the catalogue failing.
  useEffect(() => {
    if (yt.failed) {
      setFatalError("The YouTube player could not be loaded. It may be blocked on this network.");
    }
  }, [yt.failed]);

  // Unmute as soon as the user interacts, if autoplay had to start muted.
  useEffect(() => {
    if (!yt.autoMuted) return;
    const unmute = () => {
      yt.setMuted(false);
      setMuted(false);
    };
    document.addEventListener("pointerdown", unmute, { once: true });
    document.addEventListener("keydown", unmute, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unmute);
      document.removeEventListener("keydown", unmute);
    };
  }, [yt.autoMuted, yt]);

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
    busy: switching || yt.buffering,
    fatalError,
    offline,
    retrying,
    autoMuted: yt.autoMuted,
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
    reload: retry,
  };
}
