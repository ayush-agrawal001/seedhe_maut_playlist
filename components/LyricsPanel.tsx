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
