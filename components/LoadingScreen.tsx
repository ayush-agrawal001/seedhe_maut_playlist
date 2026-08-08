"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Full-screen boot curtain. Held for a minimum dwell (see PlayerShell) so the
 * disclaimer is readable.
 *
 * On exit the logo is measured against the hero logo underneath and flown onto
 * it (a FLIP transition), while the curtain's background and copy fade away —
 * so the mark reads as one continuous element rather than two that swap.
 */
export default function LoadingScreen({ show, message }: { show: boolean; message?: string }) {
  const [mounted, setMounted] = useState(true);
  const logoRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (show) {
      setMounted(true);
      return;
    }

    const boot = logoRef.current;
    const hero = document.querySelector<HTMLElement>(".hero__logo");

    if (boot && hero) {
      const a = boot.getBoundingClientRect();
      const b = hero.getBoundingClientRect();
      if (a.width && b.width) {
        const dx = b.left + b.width / 2 - (a.left + a.width / 2);
        const dy = b.top + b.height / 2 - (a.top + a.height / 2);
        const scale = b.width / a.width;
        boot.style.transition = "transform .95s cubic-bezier(.16,.84,.24,1)";
        boot.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      }
    }

    const t = setTimeout(() => setMounted(false), 1000);
    return () => clearTimeout(t);
  }, [show]);

  if (!mounted) return null;

  return (
    <div className={`boot${show ? "" : " boot--done"}`} role="status" aria-live="polite">
      <div className="boot__inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={logoRef}
          className="boot__logo"
          src="/assets/logo.png"
          alt="Seedhe Maut"
          draggable={false}
        />

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
