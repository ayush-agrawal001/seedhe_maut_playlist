import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog } from "@/lib/server/catalog";
import { ARTIST, OG_IMAGE, abs } from "@/lib/seo";
import { SeoHeader, SeoFooter } from "@/components/SeoNav";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Seedhe Maut Albums & EPs — Full Discography",
  description:
    "Seedhe Maut's discography: Bayaan, न ज़मीन न आसमां, Lunch Break, Nayaab and more, with artwork and track counts. Play any album free in a full-screen web player.",
  alternates: { canonical: "/albums" },
  openGraph: { images: [OG_IMAGE],
    title: "Seedhe Maut Albums & EPs — Full Discography",
    description: "Bayaan, न ज़मीन न आसमां, Lunch Break and more, with artwork and track counts.",
    url: abs("/albums"),
  },
};

export default async function AlbumsPage() {
  let albums: Awaited<ReturnType<typeof getCatalog>>["albums"] = [];
  try {
    albums = (await getCatalog()).albums;
  } catch {
    albums = [];
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Seedhe Maut discography",
    url: abs("/albums"),
    numberOfItems: albums.length,
    itemListElement: albums.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "MusicAlbum",
        name: a.name,
        url: abs(`/albums/${a.id}`),
        numTracks: a.trackCount,
        ...(a.year ? { datePublished: String(a.year) } : {}),
        ...(a.cover ? { image: a.cover } : {}),
        byArtist: { "@type": "MusicGroup", name: ARTIST.name },
      },
    })),
  };

  return (
    <main className="doc">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SeoHeader />

      <h1>Seedhe Maut albums and EPs</h1>
      <p className="doc__lead">
        The full Seedhe Maut discography as it appears in the player — {albums.length}{" "}
        releases from the Delhi duo of Encore ABJ and Calm. Pick any record below, or just
        open the <Link href="/">player</Link> and let it choose for you.
      </p>

      {albums.length === 0 ? (
        <p className="doc__empty">
          The catalogue could not be loaded right now. Try the <Link href="/">player</Link>.
        </p>
      ) : (
        <ul className="doc__grid">
          {albums.map((a) => (
            <li key={a.id}>
              <Link href={`/albums/${a.id}`} className="doc__card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.cover ? <img src={a.cover} alt={`${a.name} album cover`} loading="lazy" /> : <span className="doc__card-blank" />}
                <span className="doc__card-name">{a.name}</span>
                <span className="doc__card-meta">
                  {a.year ? `${a.year} · ` : ""}{a.trackCount} track{a.trackCount === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <SeoFooter />
    </main>
  );
}
