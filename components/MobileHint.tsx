"use client";

import { useEffect, useState } from "react";

/**
 * One-off nudge for phone visitors: the piece is built around a full-screen
 * backdrop and a fullscreen key, so it lands better on a desktop. Shows once
 * after boot and retires itself after five seconds.
 */
export default function MobileHint({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!show) return;
    if (!window.matchMedia("(max-width: 720px)").matches) return;

    setMounted(true);
    const inTimer = setTimeout(() => setVisible(true), 400);
    const outTimer = setTimeout(() => setVisible(false), 5400);
    const dropTimer = setTimeout(() => setMounted(false), 6200);
    return () => {
      clearTimeout(inTimer);
      clearTimeout(outTimer);
      clearTimeout(dropTimer);
    };
  }, [show]);

  if (!mounted) return null;

  return (
    <div className={`mobilehint${visible ? " in" : ""}`} role="status">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M3 5.5h18v10H3zM8 19.5h8M12 15.5v4" />
      </svg>
      <span>
        Best on a desktop — bigger screen, fullscreen visuals.
      </span>
    </div>
  );
}
