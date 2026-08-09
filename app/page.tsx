import type { Metadata } from "next";
import Link from "next/link";
import PlayerShell from "@/components/PlayerShell";
import { DESCRIPTION, OG_IMAGE, abs } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Seedhe Maut Player — Listen to Seedhe Maut Online, Free",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { images: [OG_IMAGE], url: abs("/") },
};

export default function Page() {
  return (
    <>
      {/*
        The player is a canvas with no readable text, so the page needs a real
        heading and a real paragraph for crawlers and screen readers alike.
        This is genuine page content read out by assistive tech — not hidden
        keyword stuffing — so it stays short and accurate.
      */}
      <div className="sr-only">
        <h1>Seedhe Maut Player — listen to Seedhe Maut online, free</h1>
        <p>
          A full-screen web player that plays only Seedhe Maut, the Hindi hip hop duo from
          New Delhi made up of Encore ABJ and Calm. Press play for a random track from
          across Bayaan, न ज़मीन न आसमां, Lunch Break and their singles. No sign-up and no
          algorithm. Playback runs through YouTube&rsquo;s official player.
        </p>
        <nav aria-label="Site">
          <Link href="/songs">All Seedhe Maut songs</Link>
          <Link href="/albums">Seedhe Maut albums</Link>
          <Link href="/about">About this player</Link>
        </nav>
      </div>

      <PlayerShell />
    </>
  );
}
