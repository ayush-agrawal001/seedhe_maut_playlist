"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Full-screen album-reactive backdrop.
 *
 * Each cover is probed before it is shown: YouTube only serves
 * `maxresdefault.jpg` for some videos, and a missing one would otherwise leave
 * a broken or grey placeholder on screen. If it fails to load we simply keep
 * the black base.
 */
export default function Background({ cover, hidden = false }: { cover: string; hidden?: boolean }) {
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
    const img = new Image();

    img.onload = () => {
      if (cancelled) return;
      // A 404 thumbnail can still "load" as YouTube's 120x90 grey placeholder.
      if (img.naturalWidth <= 120 && img.naturalHeight <= 90) {
        setIncoming(null);
        setShown("");
        return;
      }
      setIncoming(cover);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setShown(cover);
        setIncoming(null);
      }, 1200);
    };

    img.onerror = () => {
      if (cancelled) return;
      // No usable artwork — fall back to black rather than a broken image.
      setIncoming(null);
      setShown("");
    };

    img.src = cover;

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [cover, shown]);

  return (
    <div className={`bg${hidden ? " bg--off" : ""}`} aria-hidden>
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
