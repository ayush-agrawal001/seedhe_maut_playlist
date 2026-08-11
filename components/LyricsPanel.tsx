"use client";

import { useEffect, useRef, useState } from "react";

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
 * innerHTML never executes embedded <script> tags (a DOM safety rule, not a
 * bug), so the script Genius ships alongside the div has to be pulled out and
 * re-inserted as a real element — otherwise the div just sits there empty.
 */
function GeniusEmbed({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html;

    for (const old of Array.from(el.querySelectorAll("script"))) {
      const fresh = document.createElement("script");
      if (old.src) fresh.src = old.src;
      else fresh.textContent = old.textContent;
      for (const attr of Array.from(old.attributes)) {
        if (attr.name !== "src") fresh.setAttribute(attr.name, attr.value);
      }
      old.replaceWith(fresh);
    }

    return () => {
      el.innerHTML = "";
    };
  }, [html]);

  return <div className="lyrics__embed" ref={ref} />;
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
