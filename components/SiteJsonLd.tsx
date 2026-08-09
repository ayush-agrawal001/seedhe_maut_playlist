import { ARTIST, DESCRIPTION, SITE, abs } from "@/lib/seo";

/**
 * Site-wide structured data.
 *
 * WebSite + WebApplication describe the product; MusicGroup tells Google what
 * the site is *about*, which is what earns entity association with the artist
 * and a shot at the knowledge-panel "listen on" style results.
 */
export default function SiteJsonLd() {
  const graph = [
    {
      "@type": "WebSite",
      "@id": abs("/#website"),
      url: SITE.url,
      name: SITE.name,
      description: DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": abs("/#person") },
      about: { "@id": abs("/#artist") },
    },
    {
      "@type": "WebApplication",
      "@id": abs("/#app"),
      name: SITE.name,
      url: SITE.url,
      applicationCategory: "MultimediaApplication",
      applicationSubCategory: "Music Player",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires JavaScript and a modern browser",
      description: DESCRIPTION,
      screenshot: abs("/og.png"),
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      about: { "@id": abs("/#artist") },
    },
    {
      "@type": "MusicGroup",
      "@id": abs("/#artist"),
      name: ARTIST.name,
      alternateName: ["SMX", "सीधे मौत"],
      genre: [...ARTIST.genres],
      foundingLocation: { "@type": "Place", name: ARTIST.origin },
      member: ARTIST.members.map((name) => ({ "@type": "Person", name })),
      sameAs: [ARTIST.spotify, ARTIST.youtube, ARTIST.wikipedia, ARTIST.instagram],
    },
    {
      "@type": "Person",
      "@id": abs("/#person"),
      name: "Ayush Agrawal",
      alternateName: "bunnyTheRobo",
      url: SITE.url,
      sameAs: [
        "https://x.com/bunnyTheRobo001",
        "https://www.instagram.com/bunnytherobo",
        "https://github.com/ayush-agrawal001",
      ],
    },
  ];

  return (
    <script
      type="application/ld+json"
      // Static, developer-authored JSON — no user input reaches this.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}
