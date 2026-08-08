"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hosts the official YouTube IFrame player.
 *
 *   off   — player kept mounted but visually hidden (audio continues)
 *   panel — small draggable window
 *   bg    — fills the screen behind everything
 *
 * The player node is never re-parented or unmounted; only the wrapper's
 * classes change, so switching modes cannot restart playback.
 *
 * ⚠️ YouTube's API Terms of Service require the player to remain visible
 * (>=200x200) while media plays. `off` hides it, which does not meet that
 * requirement — see the README note before deploying this publicly.
 */

const PANEL_W = 356;
const PANEL_H = 200;
const MARGIN = 18;

interface Props {
  containerId: string;
  /** false = hidden entirely */
  visible: boolean;
  asBackground: boolean;
  onToggleBackground: () => void;
  title: string;
}

export default function VideoPanel({
  containerId,
  visible,
  asBackground,
  onToggleBackground,
  title,
}: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ dx: 0, dy: 0 });

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.max(MARGIN - PANEL_W + 90, Math.min(x, window.innerWidth - 90)),
      y: Math.max(MARGIN, Math.min(y, window.innerHeight - 60)),
    }),
    []
  );

  useEffect(() => {
    if (pos || typeof window === "undefined") return;
    setPos({
      x: window.innerWidth - PANEL_W - MARGIN,
      y: Math.max(MARGIN, window.innerHeight - PANEL_H - 190),
    });
  }, [pos]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (asBackground || !pos) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
      setDragging(true);
    },
    [asBackground, pos]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setPos(clamp(e.clientX - dragRef.current.dx, e.clientY - dragRef.current.dy));
    },
    [dragging, clamp]
  );

  const endDrag = useCallback(() => setDragging(false), []);

  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const mode = !visible ? "off" : asBackground ? "bg" : "panel";

  const style: React.CSSProperties =
    mode === "panel"
      ? { left: pos?.x ?? 0, top: pos?.y ?? 0, width: PANEL_W, visibility: pos ? "visible" : "hidden" }
      : {};

  return (
    <div
      className={`vid vid--${mode}${dragging ? " vid--dragging" : ""}`}
      style={style}
      aria-hidden={mode === "off"}
    >
      {mode === "panel" && (
        <div
          className="vid__grip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="vid__dots" aria-hidden>
            ⠿
          </span>
          <span className="vid__title">{title}</span>
        </div>
      )}

      <div className="vid__frame">
        {/* The IFrame API replaces this node with the <iframe>. */}
        <div id={containerId} />
      </div>

      {mode !== "off" && (
        <button
          className="vid__mode"
          onClick={onToggleBackground}
          title={asBackground ? "Show album cover background" : "Use video as background"}
        >
          {asBackground ? "Cover BG" : "Video BG"}
        </button>
      )}
    </div>
  );
}
