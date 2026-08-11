"use client";

import { useEffect, useRef, useState } from "react";
import { coverCandidates, probeBestImage } from "@/lib/ytThumb";

/**
 * Full-screen album-reactive backdrop — now the only visual behind the app,
 * so getting a real image matters more than it used to.
 *
 * Each cover is probed before it's shown, walking a quality fallback chain
 * for YouTube thumbnails (maxres -> sd -> hq) rather than giving up to black
 * on the first miss. See lib/ytThumb.ts for why that chain is necessary.
 */
export default function Background({ cover }: { cover: string }) {
  const [shown, setShown] = useState("");
  const [incoming, setIncoming] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!cover) {
      setShown("");
      setIncoming(null);
      return;
    }
    if (cover === shown) return;

    let cancelled = false;

    probeBestImage(coverCandidates(cover)).then((best) => {
      if (cancelled) return;
      if (!best) {
        // No usable artwork at any quality — fall back to black.
        setIncoming(null);
        setShown("");
        return;
      }
      setIncoming(best);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (cancelled) return;
        setShown(best);
        setIncoming(null);
      }, 1200);
    });

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [cover, shown]);

  return (
    <div className="bg" aria-hidden>
      <div
        className="bg__image"
        style={{ backgroundImage: shown ? `url("${shown}")` : undefined }}
      />
      <div
        className="bg__image bg__image--in"
        style={{
          backgroundImage: incoming ? `url("${incoming}")` : undefined,
          opacity: incoming ? 1 : 0,
        }}
      />
      <div className="bg__vignette" />
      <div className="bg__grain" />
    </div>
  );
}
