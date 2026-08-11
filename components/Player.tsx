"use client";

import { useEffect, useState } from "react";
import { fmt } from "@/lib/format";
import type { ApiTrack } from "@/lib/types";

interface Props {
  current: ApiTrack;
  playing: boolean;
  busy: boolean;
  curTime: number;
  dur: number;
  volume: number;
  muted: boolean;
  queueOpen: boolean;
  lyricsOpen: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onVolume: (v: number) => void;
  onToggleMute: () => void;
  onToggleQueue: () => void;
  onToggleLyrics: () => void;
}

export default function Player({
  current,
  playing,
  busy,
  curTime,
  dur,
  volume,
  muted,
  queueOpen,
  lyricsOpen,
  onToggle,
  onNext,
  onPrev,
  onSeek,
  onVolume,
  onToggleMute,
  onToggleQueue,
  onToggleLyrics,
}: Props) {
  const [drag, setDrag] = useState<number | null>(null);
  const [artOk, setArtOk] = useState(true);

  // Reset the artwork probe whenever the track changes.
  useEffect(() => setArtOk(true), [current.cover]);
  const shown = drag ?? curTime;
  const pct = dur > 0 ? Math.min(100, (shown / dur) * 100) : 0;

  const commit = () => {
    if (drag != null) onSeek(drag);
    setDrag(null);
  };

  const volPct = (muted ? 0 : volume) * 100;

  return (
    <div className={`player${playing ? " playing" : ""}${busy ? " busy" : ""}`} id="player">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {artOk && current.cover ? (
        <img
          className="player__disc"
          src={current.cover}
          alt={`${current.album} cover`}
          draggable={false}
          onClick={onToggleQueue}
          onError={() => setArtOk(false)}
          onLoad={(e) => {
            // YouTube serves a 120x90 grey placeholder for missing thumbnails.
            const i = e.currentTarget;
            if (i.naturalWidth <= 120 && i.naturalHeight <= 90) setArtOk(false);
          }}
        />
      ) : (
        <div className="player__disc player__disc--blank" onClick={onToggleQueue} />
      )}

      <div className="player__main">
        <div className="player__title" title={current.title}>
          {current.title}
        </div>
        <div className="player__artist">{current.artists}</div>

        <div className="player__seekrow">
          <div className="player__bar" style={{ ["--pct" as string]: `${pct}%` }}>
            <span className="player__fill" />
            <span className="player__knob" />
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(dur))}
              step={1}
              value={Math.floor(shown)}
              aria-label="Seek"
              onChange={(e) => setDrag(Number(e.target.value))}
              onMouseUp={commit}
              onTouchEnd={commit}
              onKeyUp={commit}
              onBlur={commit}
            />
          </div>
        </div>

        <div className="player__time">
          {fmt(shown)} / {fmt(dur)}
        </div>
      </div>

      <div className="player__controls">
        <button className="pctl" title="Previous" aria-label="Previous" onClick={onPrev}>
          <svg viewBox="0 0 24 24">
            <path d="M7 5.5v13M19 6.2v11.6L9.5 12z" />
          </svg>
        </button>

        <button
          className="pctl pctl--play"
          title={busy ? "Loading…" : playing ? "Pause" : "Play"}
          aria-label={busy ? "Loading" : playing ? "Pause" : "Play"}
          onClick={onToggle}
          disabled={busy}
        >
          {busy ? (
            <span className="pctl__spinner" aria-hidden />
          ) : playing ? (
            <svg viewBox="0 0 24 24">
              <path d="M7.5 5h3.4v14H7.5zM13.1 5h3.4v14h-3.4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M8.5 5.4v13.2L19 12z" />
            </svg>
          )}
        </button>

        <button className="pctl" title="Next" aria-label="Next" onClick={onNext}>
          <svg viewBox="0 0 24 24">
            <path d="M17 5.5v13M5 6.2v11.6L14.5 12z" />
          </svg>
        </button>

        {/* Secondary controls fade in on hover so the pill stays clean. */}
        <div className="player__extra">
          <button
            className="pctl pctl--sm"
            title={muted ? "Unmute" : "Mute"}
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={onToggleMute}
          >
            {muted || volume === 0 ? (
              <svg viewBox="0 0 24 24">
                <path d="M4 9v6h4l5 4V5L8 9H4zM17 9.5l4 5M21 9.5l-4 5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.8a4.5 4.5 0 010 6.4" />
              </svg>
            )}
          </button>
          <input
            className="range range--vol"
            type="range"
            min={0}
            max={100}
            value={volPct}
            aria-label="Volume"
            style={{
              background: `linear-gradient(to right, rgba(255,255,255,.9) ${volPct}%, rgba(255,255,255,.18) ${volPct}%)`,
            }}
            onChange={(e) => onVolume(Number(e.target.value) / 100)}
          />
          <button
            className={`pctl pctl--sm${lyricsOpen ? " active" : ""}`}
            title="Lyrics"
            aria-label="Lyrics"
            onClick={onToggleLyrics}
          >
            <svg viewBox="0 0 24 24">
              <path d="M7 4h8l4 4v12H7V4z" />
              <path d="M15 4v4h4M9.5 12.5h5M9.5 15.5h3.5" />
            </svg>
          </button>
          <button
            className={`pctl pctl--sm${queueOpen ? " active" : ""}`}
            title="Queue"
            aria-label="Queue"
            onClick={onToggleQueue}
          >
            <svg viewBox="0 0 24 24">
              <path d="M4 7h11M4 12h11M4 17h8M18 9.5v8.2M18 18a1.6 1.6 0 100 .01" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
