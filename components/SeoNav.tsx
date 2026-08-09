import Link from "next/link";

/** Shared header/footer for the crawlable content pages. */
export function SeoHeader() {
  return (
    <header className="doc__top">
      <Link href="/" className="doc__brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo.png" alt="Seedhe Maut Player" width={92} height={91} />
      </Link>
      <nav className="doc__nav">
        <Link href="/">Player</Link>
        <Link href="/songs">Songs</Link>
        <Link href="/albums">Albums</Link>
        <Link href="/about">About</Link>
      </nav>
    </header>
  );
}

export function SeoFooter() {
  return (
    <footer className="doc__foot">
      <p>
        All music, artwork and videos belong to <strong>Seedhe Maut</strong> and their
        rightful owners. Playback runs through YouTube&rsquo;s official player — nothing is
        hosted here. This is an unofficial fan-made listening experience, not affiliated
        with or endorsed by the artist.
      </p>
      <p className="doc__foot-links">
        <Link href="/">Open the player</Link>
        <span> · </span>
        <a href="https://open.spotify.com/artist/2oBG74gAocPMFv6Ij9ykdo" target="_blank" rel="noopener noreferrer">
          Seedhe Maut on Spotify
        </a>
        <span> · </span>
        <a href="https://music.youtube.com/@SeedheMaut" target="_blank" rel="noopener noreferrer">
          on YouTube Music
        </a>
      </p>
    </footer>
  );
}
