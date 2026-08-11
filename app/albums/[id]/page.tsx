import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/server/catalog";
import { fmtMs } from "@/lib/format";
import { ARTIST, OG_IMAGE, abs } from "@/lib/seo";
import { SeoHeader, SeoFooter } from "@/components/SeoNav";
import Background from "@/components/Background";

export const revalidate = 21600;

async function findAlbum(id: string) {
  try {
    const { albums, tracks } = await getCatalog();
    const album = albums.find((a) => a.id === id);
    if (!album) return null;
    return { album, tracks: tracks.filter((t) => t.albumId === id) };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const found = await findAlbum(params.id);
  if (!found) return { title: "Album not found" };
  const { album, tracks } = found;
  const title = `${album.name} — Seedhe Maut${album.year ? ` (${album.year})` : ""}`;
  const description = `Listen to ${album.name} by Seedhe Maut${album.year ? `, released ${album.year}` : ""} — ${tracks.length} tracks${tracks.length ? `: ${tracks.slice(0, 5).map((t) => t.title).join(", ")}` : ""}. Free full-screen web player.`;
  return {
    title,
    description,
    alternates: { canonical: `/albums/${album.id}` },
    openGraph: { images: [OG_IMAGE], title, description, url: abs(`/albums/${album.id}`), ...(album.cover ? { images: [album.cover] } : {}) },
  };
}

export default async function AlbumPage({ params }: { params: { id: string } }) {
  const found = await findAlbum(params.id);
  if (!found) notFound();
  const { album, tracks } = found;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicAlbum",
    name: album.name,
    url: abs(`/albums/${album.id}`),
    numTracks: tracks.length,
    ...(album.year ? { datePublished: String(album.year) } : {}),
    ...(album.cover ? { image: album.cover } : {}),
    byArtist: { "@type": "MusicGroup", name: ARTIST.name, sameAs: [ARTIST.spotify] },
    track: tracks.map((t, i) => ({
      "@type": "MusicRecording",
      position: i + 1,
      name: t.title,
      duration: t.durationMs ? `PT${Math.round(t.durationMs / 1000)}S` : undefined,
      byArtist: { "@type": "MusicGroup", name: t.artists },
      ...(t.youtube ? { url: t.youtube.url } : {}),
    })),
  };

  return (
    <>
      <Background cover={album.cover || "/covers/na.png"} />
      <main className="doc">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SeoHeader />

      <nav aria-label="Breadcrumb" className="doc__crumbs">
        <Link href="/albums">Albums</Link> <span aria-hidden>›</span> <span>{album.name}</span>
      </nav>

      <div className="doc__album">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {album.cover && <img className="doc__album-art" src={album.cover} alt={`${album.name} album cover by Seedhe Maut`} />}
        <div>
          <h1>{album.name}</h1>
          <p className="doc__lead">
            <strong>Seedhe Maut</strong>{album.year ? ` · ${album.year}` : ""} · {tracks.length} track{tracks.length === 1 ? "" : "s"}
          </p>
          <p><Link className="doc__cta" href="/">Play it in the full-screen player →</Link></p>
        </div>
      </div>

      {tracks.length > 0 && (
        <ol className="doc__tracks">
          {tracks.map((t) => (
            <li key={t.id}>
              <span className="doc__track-title">{t.title}</span>
              <span className="doc__track-meta">{t.artists}</span>
              <span className="doc__num">{t.durationMs ? fmtMs(t.durationMs) : "—"}</span>
            </li>
          ))}
        </ol>
      )}

      <SeoFooter />
      </main>
    </>
  );
}
