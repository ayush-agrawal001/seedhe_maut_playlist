"use client";

import { useEffect, useState } from "react";

const SPOTIFY = "https://open.spotify.com/artist/2oBG74gAocPMFv6Ij9ykdo";
const YT_MUSIC = "https://music.youtube.com/@SeedheMaut";

interface Props {
  videoOn: boolean;
  onToggleVideo: () => void;
}

export default function TopBar({ videoOn, onToggleVideo }: Props) {
  const [clock, setClock] = useState("--:--");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      let h = d.getHours();
      const m = d.getMinutes();
      const ap = h >= 12 ? "pm" : "am";
      h = h % 12 || 12;
      setClock(`${h}:${String(m).padStart(2, "0")} ${ap}`);
    };
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar__clock">{clock}</div>

      <nav className="topbar__links">
        <button
          className={`vtoggle${videoOn ? " on" : ""}`}
          role="switch"
          aria-checked={videoOn}
          onClick={onToggleVideo}
          title={videoOn ? "Hide video" : "Show video"}
        >
          <span className="vtoggle__label">Video</span>
          <span className="vtoggle__track">
            <span className="vtoggle__thumb" />
          </span>
        </button>

        <a className="tlink" href={SPOTIFY} target="_blank" rel="noopener noreferrer">
          <span className="tlink__badge">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path
                d="M6.4 9.1c3.7-1.05 7.7-.75 11 1.05M7 12.35c3-.85 6.3-.55 9 1.2M7.7 15.5c2.4-.65 4.9-.4 7 .95"
                stroke="#0b0b0d"
                strokeWidth="1.9"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </span>
          Spotify <span className="tlink__arr">↗</span>
        </a>

        <a className="tlink" href={YT_MUSIC} target="_blank" rel="noopener noreferrer">
          <span className="tlink__badge">
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="8.4" stroke="#0b0b0d" strokeWidth="1.7" fill="none" />
              <path d="M10.2 8.6l6 3.4-6 3.4z" fill="#0b0b0d" stroke="none" />
            </svg>
          </span>
          YT Music <span className="tlink__arr">↗</span>
        </a>
      </nav>
    </header>
  );
}
