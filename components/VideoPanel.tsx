"use client";

/**
 * Hosts the official YouTube IFrame player, off-screen.
 *
 * This node has to exist somewhere in the DOM for the IFrame API to attach to
 * and produce audio — it's the actual playback engine, not just a visual —
 * but nothing in the UI shows it. Only the wrapper's class ever changes
 * (never re-parented/unmounted), so it can't interrupt playback.
 *
 * ⚠️ YouTube's API Terms of Service require the player to stay visible
 * (>=200x200) while media plays. Keeping it permanently off-screen does not
 * meet that requirement — see the README note before deploying this publicly.
 */
export default function VideoPanel({ containerId }: { containerId: string }) {
  return (
    <div className="vid vid--off" aria-hidden>
      <div className="vid__frame">
        {/* The IFrame API replaces this node with the <iframe>. */}
        <div id={containerId} />
      </div>
    </div>
  );
}
