"use client";

import { useEffect, useMemo, useState } from "react";

interface LyricsResponse {
  found: boolean;
  reason?: "not_configured";
  embedContent?: string;
  geniusUrl?: string;
  title?: string;
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
 * client-rendered React app). Injecting it into the live page silently fails
 * with "Failed to execute 'write' on 'Document'" and nothing ever renders.
 * An <iframe srcDoc> sidesteps this: its content gets a genuine fresh parse
 * as its own document, so the script is parser-inserted there and
 * document.write() works exactly as Genius intends.
 */
function GeniusEmbed({ html }: { html: string }) {
  const srcDoc = useMemo(
    () => `<!doctype html>
<html>
<head>
<base target="_blank">
<meta name="referrer" content="no-referrer-when-downgrade">
<style>
  html, body {
    margin: 0; padding: 14px;
    background: #fff; color: #111;
    font: 15px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  a { color: #f13f42; }
  img { max-width: 100%; }
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
}: {
  open: boolean;
  title: string;
  artist: string;
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

  return (
    <section id="lyrics-panel" className="queue lyrics-panel open" aria-label="Lyrics">
      <div className="lyrics__head">
        <span>Lyrics</span>
        {state.data?.geniusUrl && (
          <a href={state.data.geniusUrl} target="_blank" rel="noopener noreferrer">
            Genius ↗
          </a>
        )}
      </div>

      {state.loading && <div className="lyrics__status">Looking it up…</div>}

      {!state.loading && state.data?.found && state.data.embedContent && (
        <GeniusEmbed html={state.data.embedContent} />
      )}

      {!state.loading && !state.data?.found && state.data?.reason === "not_configured" && (
        <div className="lyrics__status">Lyrics aren&rsquo;t set up on this deployment yet.</div>
      )}

      {!state.loading && !state.data?.found && state.data?.reason !== "not_configured" && (
        <div className="lyrics__status">No lyrics found for this one yet.</div>
      )}
    </section>
  );
}
