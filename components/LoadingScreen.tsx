"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen boot curtain. Held for a minimum dwell (see PlayerShell) so the
 * disclaimer is readable, then fades straight out — the hero logo is simply
 * already in place underneath.
 */
export default function LoadingScreen({ show, message }: { show: boolean; message?: string }) {
  const [mounted, setMounted] = useState(true);

  // Keep the node around for the fade-out, then drop it.
  useEffect(() => {
    if (show) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), 900);
    return () => clearTimeout(t);
  }, [show]);

  if (!mounted) return null;

  return (
    <div className={`boot${show ? "" : " boot--done"}`} role="status" aria-live="polite">
      <div className="boot__inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="boot__logo" src="/assets/logo.png" alt="Seedhe Maut" draggable={false} />

        <div className="boot__bar">
          <span className="boot__fill" />
        </div>

        <div className="boot__msg">{message ?? "Loading the catalogue"}</div>

        <p className="boot__disclaimer">
          All music, artwork and videos belong to <strong>Seedhe Maut</strong> and their
          rightful owners. Playback runs through YouTube&rsquo;s official player — nothing is
          hosted here. This site is an unofficial fan-made listening experience, not
          affiliated with or endorsed by the artist.
        </p>
      </div>
    </div>
  );
}
