"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Full-screen album-reactive backdrop.
 * The current cover is shown blurred/darkened; when it changes we crossfade
 * the new one in over the old.
 */
export default function Background({ cover, hidden = false }: { cover: string; hidden?: boolean }) {
  const [shown, setShown] = useState(cover);
  const [incoming, setIncoming] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!cover || cover === shown) return;
    setIncoming(cover);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setShown(cover);
      setIncoming(null);
    }, 1200);
    return () => {
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
