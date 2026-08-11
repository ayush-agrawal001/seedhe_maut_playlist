"use client";

/**
 * Hosts the official YouTube IFrame player.
 *
 *   off — kept mounted but out of sight (audio continues)
 *   bg  — fills the screen behind everything
 *
 * The player node is never re-parented or unmounted; only the wrapper's class
 * changes, so switching modes cannot restart playback.
 *
 * ⚠️ YouTube's API Terms of Service require the player to stay visible
 * (>=200x200) while media plays. `off` hides it, which does not meet that
 * requirement — see the README note before deploying this publicly.
 */
export default function VideoPanel({
  containerId,
  visible,
}: {
  containerId: string;
  visible: boolean;
}) {
  return (
    <div className={`vid vid--${visible ? "bg" : "off"}`} aria-hidden={!visible}>
      <div className="vid__frame">
        {/* The IFrame API replaces this node with the <iframe>. */}
        <div id={containerId} />
      </div>
    </div>
  );
}
