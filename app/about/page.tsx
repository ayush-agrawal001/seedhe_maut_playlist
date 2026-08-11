import type { Metadata } from "next";
import Link from "next/link";
import { ARTIST, OG_IMAGE, abs } from "@/lib/seo";
import { SeoHeader, SeoFooter } from "@/components/SeoNav";
import Background from "@/components/Background";

export const metadata: Metadata = {
  title: "About — a web player that plays only Seedhe Maut",
  description:
    "Why this exists, how it works, and what it does not do. A fan-made full-screen player for Seedhe Maut, built on the Spotify Web API and YouTube's official player.",
  alternates: { canonical: "/about" },
  openGraph: { images: [OG_IMAGE],
    title: "About — a web player that plays only Seedhe Maut",
    description: "Why this exists, how it works, and what it does not do.",
    url: abs("/about"),
  },
};

const FAQ = [
  {
    q: "Is it free to listen to Seedhe Maut here?",
    a: "Yes. There is no sign-up, no account and no payment. Playback runs through YouTube's official embedded player, so the artist still gets the play.",
  },
  {
    q: "Which Seedhe Maut songs can I play?",
    a: "The whole catalogue the player can reach — albums, EPs and singles including Bayaan, न ज़मीन न आसमां and Lunch Break. See the full track list on the Songs page.",
  },
  {
    q: "Do the songs play in a random order?",
    a: "Yes. Every visit starts on a random track and each skip picks another, avoiding anything played recently so nothing repeats back to back.",
  },
  {
    q: "Is this the official Seedhe Maut website?",
    a: "No. It is an unofficial fan-made project, not affiliated with or endorsed by Seedhe Maut. All music and artwork belong to the artist and their rightful owners.",
  },
  {
    q: "Does it work on a phone?",
    a: "It works, but it is built around a full-screen backdrop and a fullscreen key, so it is a better experience on a laptop or desktop.",
  },
];

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <>
      <Background cover="/covers/bayaan.jpg" />
      <main className="doc">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoHeader />

      <h1>A web player that plays only Seedhe Maut</h1>

      <p className="doc__lead">
        Every music app wants to show you something else — a feed, a recommendation, a
        &ldquo;you might also like&rdquo;. This one does not. Open it, press play, and you
        get a random Seedhe Maut track filling the whole screen. That is the entire app.
      </p>

      <h2>Who are Seedhe Maut?</h2>
      <p>
        Seedhe Maut are a Hindi hip hop duo from New Delhi — <strong>Encore ABJ</strong> and{" "}
        <strong>Calm</strong> — and one of the defining acts in Indian rap. Their records
        include <em>Bayaan</em>, <em>न ज़मीन न आसमां</em> and <em>Lunch Break</em>. You can
        find them on{" "}
        <a href={ARTIST.spotify} target="_blank" rel="noopener noreferrer">Spotify</a> and{" "}
        <a href={ARTIST.youtube} target="_blank" rel="noopener noreferrer">YouTube Music</a>.
      </p>

      <h2>How it works</h2>
      <p>
        Track names, album groupings and artwork come from the{" "}
        <strong>Spotify Web API</strong>. Playback runs entirely through{" "}
        <strong>YouTube&rsquo;s official IFrame player</strong>, which is the only
        mechanism either platform permits for full songs on a third-party site. The
        backdrop reacts to whatever is playing, and a toggle swaps it for the music video.
      </p>

      <h2>What it does not do</h2>
      <p>
        No audio is downloaded, stored, proxied or extracted. No DRM is touched, no private
        endpoint is scraped, and no playback restriction is worked around. Nothing is hosted
        here — every play is a real play on YouTube.
      </p>

      <h2>Questions</h2>
      <dl className="doc__faq">
        {FAQ.map(({ q, a }) => (
          <div key={q}>
            <dt>{q}</dt>
            <dd>{a}</dd>
          </div>
        ))}
      </dl>

      <p>
        <Link className="doc__cta" href="/">Open the player →</Link>
      </p>

      <SeoFooter />
      </main>
    </>
  );
}
