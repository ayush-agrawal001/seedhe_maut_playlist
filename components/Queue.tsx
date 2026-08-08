"use client";

import { useEffect, useRef } from "react";
import { fmtMs } from "@/lib/format";
import type { ApiTrack } from "@/lib/types";

interface Props {
  open: boolean;
  tracks: ApiTrack[];
  activeId: string;
  playing: boolean;
  onSelect: (id: string) => void;
}

export default function Queue({ open, tracks, activeId, playing, onSelect }: Props) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(".track.active")?.scrollIntoView({ block: "nearest" });
  }, [open, activeId]);

  return (
    <section className={`queue${open ? " open" : ""}`} id="queue" aria-hidden={!open}>
      <div className="queue__head">
        <span>Up Next</span>
        <span>{tracks.length} songs</span>
      </div>
      <ol className="tracklist" ref={listRef}>
        {tracks.map((t, i) => {
          const active = t.id === activeId;
          return (
            <li
              key={t.id}
              className={`track${active ? " active" : ""}${active && playing ? " playing" : ""}`}
              onClick={() => onSelect(t.id)}
            >
              <div className="track__idx">{i + 1}</div>
              <div className="track__eq">
                <span />
                <span />
                <span />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="track__art"
                src={t.cover}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
              <div className="track__body">
                <div className="track__title">{t.title}</div>
                <div className="track__sub">
                  {t.artists} · {t.album}
                </div>
              </div>
              <div className="track__dur">{fmtMs(t.durationMs)}</div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
