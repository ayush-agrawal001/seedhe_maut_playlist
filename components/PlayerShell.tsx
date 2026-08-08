"use client";

import { useEffect, useState } from "react";
import Background from "@/components/Background";
import TopBar from "@/components/TopBar";
import Hero from "@/components/Hero";
import Queue from "@/components/Queue";
import Player from "@/components/Player";
import VideoPanel from "@/components/VideoPanel";
import LoadingScreen from "@/components/LoadingScreen";
import { useCatalogPlayer } from "@/hooks/useCatalogPlayer";

const PLAYER_ID = "yt-player";

/** Minimum time the boot screen stays up, so the disclaimer is readable. */
const MIN_BOOT_MS = 5000;

export default function PlayerShell() {
  const p = useCatalogPlayer(PLAYER_ID);
  const [queueOpen, setQueueOpen] = useState(false);
  const [bootHeld, setBootHeld] = useState(true);
  const [videoOn, setVideoOn] = useState(false); // video hidden by default
  const [videoBg, setVideoBg] = useState(false);

  // Hold the boot screen for a minimum dwell even if the catalogue is cached.
  useEffect(() => {
    const t = setTimeout(() => setBootHeld(false), MIN_BOOT_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !document.getElementById("queue")?.contains(target) &&
        !document.getElementById("player")?.contains(target)
      ) {
        setQueueOpen(false);
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <>
      {/* The video only shows through while it is actually playing — a paused
          YouTube frame is dead air, so the cover comes back over it. */}
      <Background
        cover={p.current?.cover ?? ""}
        hidden={videoOn && videoBg && p.playing}
      />
      <TopBar
        videoOn={videoOn}
        onToggleVideo={() => {
          // Turning the video on also switches the backdrop to it; the
          // "Cover BG" button inside the panel can switch it back.
          const next = !videoOn;
          setVideoOn(next);
          setVideoBg(next);
        }}
      />
      <Hero docked={videoOn} />

      <LoadingScreen show={p.loading || bootHeld} />

      {p.error && (
        <div className="notice notice--error" role="alert">
          {p.error}
          <button className="notice__retry" onClick={p.reload}>
            Retry
          </button>
        </div>
      )}


      {videoOn && p.lowQuality && (
        <div className="notice notice--warn" role="status">
          <span className="notice__badge">{p.qualityLabel}</span>
          Low video quality — switch to a faster connection for the full experience.
        </div>
      )}

      <VideoPanel
        containerId={PLAYER_ID}
        visible={videoOn}
        asBackground={videoOn && videoBg}
        onToggleBackground={() => setVideoBg((v) => !v)}
        title={p.current?.title ?? ""}
      />

      <Queue
        open={queueOpen}
        tracks={p.tracks}
        activeId={p.current?.id ?? ""}
        playing={p.playing}
        onSelect={(id) => {
          const t = p.tracks.find((x) => x.id === id);
          if (t) p.playTrack(t);
        }}
      />

      {p.current && (
        <Player
          current={p.current}
          playing={p.playing}
          curTime={p.curTime}
          dur={p.dur}
          volume={p.volume}
          muted={p.muted}
          queueOpen={queueOpen}
          onToggle={p.toggle}
          onNext={p.next}
          onPrev={p.prev}
          onSeek={p.seek}
          onVolume={p.setVolume}
          onToggleMute={p.toggleMute}
          onToggleQueue={() => setQueueOpen((o) => !o)}
        />
      )}
    </>
  );
}
