import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog } from "@/lib/server/catalog";
import { fmtMs } from "@/lib/format";
import { ARTIST, OG_IMAGE, abs } from "@/lib/seo";
import { SeoHeader, SeoFooter } from "@/components/SeoNav";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "All Seedhe Maut Songs — Full Track List",
  description:
    "Every Seedhe Maut song available in the player, with album and running time. Listen to any track free in a full-screen web player — no sign-up, no algorithm.",
  alternates: { canonical: "/songs" },
  openGraph: { images: [OG_IMAGE],
    title: "All Seedhe Maut Songs — Full Track List",
    description:
      "Every Seedhe Maut song available in the player, with album and running time.",
    url: abs("/songs"),
  },
};

export default async function SongsPage() {
  let tracks: Awaited<ReturnType<typeof getCatalog>>["tracks"] = [];
  try {
    tracks = (await getCatalog()).tracks;
  } catch {
    tracks = [];
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicPlaylist",
    name: "Seedhe Maut — every song",
    url: abs("/songs"),
    numTracks: tracks.length,
    byArtist: { "@type": "MusicGroup", name: ARTIST.name },
    track: tracks.slice(0, 100).map((t, i) => ({
      "@type": "MusicRecording",
      position: i + 1,
      name: t.title,
      duration: t.durationMs ? `PT${Math.round(t.durationMs / 1000)}S` : undefined,
      inAlbum: { "@type": "MusicAlbum", name: t.album },
      byArtist: { "@type": "MusicGroup", name: t.artists },
      ...(t.youtube ? { url: t.youtube.url } : {}),
    })),
  };

  return (
    <main className="doc">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoHeader />

      <h1>All Seedhe Maut songs</h1>
      <p className="doc__lead">
        Every Seedhe Maut track currently in the player — {tracks.length} songs across the
        duo&rsquo;s albums, EPs and singles. Encore ABJ and Calm have been putting out some
        of the sharpest Hindi rap out of Delhi since 2016, and this page lists the lot.
        Open the <Link href="/">player</Link> to hear a random one full screen.
      </p>

      {tracks.length === 0 ? (
        <p className="doc__empty">
          The catalogue could not be loaded right now. Try the{" "}
          <Link href="/">player</Link> — it retries automatically.
        </p>
      ) : (
        <table className="doc__table">
          <caption className="sr-only">
            Seedhe Maut songs with album and duration
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Song</th>
              <th scope="col">Album</th>
              <th scope="col">Length</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((t, i) => (
              <tr key={t.id}>
                <td className="doc__num">{i + 1}</td>
                <th scope="row">{t.title}</th>
                <td>{t.album}</td>
                <td className="doc__num">{t.durationMs ? fmtMs(t.durationMs) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <SeoFooter />
    </main>
  );
}
