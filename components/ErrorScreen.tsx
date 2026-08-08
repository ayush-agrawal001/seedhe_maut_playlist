"use client";

/**
 * Full-screen failure state, shown when the app cannot start at all — the
 * catalogue never arrived, or the YouTube player never came up. Transient
 * problems (a single track failing) use the small notice pill instead.
 */
export default function ErrorScreen({
  title,
  detail,
  offline,
  retrying,
  onRetry,
}: {
  title: string;
  detail?: string | null;
  offline: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="fail" role="alert">
      <div className="fail__inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="fail__logo" src="/assets/logo.png" alt="Seedhe Maut" draggable={false} />

        <div className="fail__title">
          {offline ? "You’re offline" : title}
        </div>

        <p className="fail__detail">
          {offline
            ? "Waiting for your connection to come back — this will retry on its own."
            : detail || "Could not reach the server."}
        </p>

        <button className="fail__retry" onClick={onRetry} disabled={retrying}>
          {retrying ? "Retrying…" : "Try again"}
        </button>
      </div>
    </div>
  );
}
