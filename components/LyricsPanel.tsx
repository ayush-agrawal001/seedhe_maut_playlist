"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface SyncedLine {
  time: number;
  text: string;
}

type LyricsResponse =
  | { found: true; kind: "synced"; lines: SyncedLine[] }
  | { found: true; kind: "genius"; embedContent: string; geniusUrl: string; title: string }
  | { found: false };

/**
 * Real, timestamped lyrics (lrclib.net) rendered natively — no iframe needed
 * here, since this is just data we own the styling of end to end. The active
 * line is whichever one's timestamp has most recently passed; clicking any
 * line seeks there.
 */
function SyncedLyrics({
  lines,
  curTime,
  onSeek,
}: {
  lines: SyncedLine[];
  curTime: number;
  onSeek: (seconds: number) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  const activeIndex = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.time <= curTime) idx = i;
      else break;
    }
    return idx;
  }, [lines, curTime]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <div className="lyrics__synced">
      {lines.map((l, i) => (
        <button
          key={i}
          ref={i === activeIndex ? activeRef : undefined}
          type="button"
          className={`lyrics__line${i === activeIndex ? " active" : i < activeIndex ? " past" : ""}`}
          onClick={() => onSeek(l.time)}
        >
          {l.text}
        </button>
      ))}
    </div>
  );
}

/**
 * Renders Genius's official embed — the exact <div>+<script> snippet their
 * API hands out for third-party display, the sanctioned mechanism (same
 * relationship YouTube's IFrame player has to raw video files). We never
 * read or render raw lyric text ourselves.
 *
 * Genius's embed.js writes its content via document.write(), which browsers
 * only allow for scripts the HTML parser encounters directly — never for a
 * script inserted after the fact via JS (which is the only option in a
 * client-rendered React app). An <iframe srcDoc> sidesteps this: its content
 * gets a genuine fresh parse as its own document, so the script is
 * parser-inserted there and document.write() works exactly as Genius intends.
 */
function GeniusEmbed({ html }: { html: string }) {
  const srcDoc = useMemo(
    () => `<!doctype html>
<html>
<head>
<base target="_blank">
<meta name="referrer" content="no-referrer-when-downgrade">
<style>
  /* Only the wrapping page is ours — Genius's script writes its own content
     into <body> below. It renders as plain, unstyled elements (no inline
     colors of its own), so it inherits this palette and reads as part of
     the site rather than a pasted-in white card. Their own attribution
     badge keeps its brand colours regardless, which is expected. */
  html, body {
    margin: 0; padding: 18px 20px 24px;
    background: transparent;
    color: rgba(255,255,255,.82);
    font: 14.5px/1.85 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  * { box-sizing: border-box; }
  a { color: #ff6b6b; text-decoration: none; }
  a:hover { text-decoration: underline; }
  img { max-width: 100%; }
  ::selection { background: rgba(255,107,107,.35); }
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.18); border-radius: 999px; }
</style>
</head>
<body>${html}</body>
</html>`,
    [html]
  );

  return (
    <iframe
      className="lyrics__embed"
      srcDoc={srcDoc}
      title="Lyrics via Genius"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      loading="lazy"
    />
  );
}

export default function LyricsPanel({
  open,
  title,
  artist,
  curTime,
  onSeek,
}: {
  open: boolean;
  title: string;
  artist: string;
  curTime: number;
  onSeek: (seconds: number) => void;
}) {
  const [state, setState] = useState<{ loading: boolean; data: LyricsResponse | null }>({
    loading: true,
    data: null,
  });

  useEffect(() => {
    if (!open || !title) return;
    let cancelled = false;
    setState({ loading: true, data: null });

    const qs = new URLSearchParams({ title, artist });
    fetch(`/api/lyrics?${qs}`)
      .then((r) => r.json())
      .then((data: LyricsResponse) => {
        if (!cancelled) setState({ loading: false, data });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, data: { found: false } });
      });

    return () => {
      cancelled = true;
    };
  }, [open, title, artist]);

  if (!open) return null;

  const data = state.data;
  const isGenius = data?.found && data.kind === "genius";
  const isSynced = data?.found && data.kind === "synced";

  return (
    <section id="lyrics-panel" className="queue lyrics-panel open" aria-label="Lyrics">
      <div className="lyrics__head">
        <span>
          Lyrics
          {isSynced && <span className="lyrics__source"> · lrclib.net</span>}
        </span>
        {isGenius && (
          <a href={data.geniusUrl} target="_blank" rel="noopener noreferrer">
            Genius ↗
          </a>
        )}
      </div>

      {state.loading && <div className="lyrics__status">Looking it up…</div>}

      {!state.loading && isSynced && (
        <SyncedLyrics lines={data.lines} curTime={curTime} onSeek={onSeek} />
      )}

      {!state.loading && isGenius && <GeniusEmbed html={data.embedContent} />}

      {!state.loading && !data?.found && (
        <div className="lyrics__status">No lyrics found for this one yet.</div>
      )}
    </section>
  );
}
