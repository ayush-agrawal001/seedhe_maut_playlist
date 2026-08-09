/** Single source of truth for site-wide SEO values. */

export const SITE = {
  url: "https://www.seedhemaut.world",
  name: "Seedhe Maut Player",
  shortName: "Seedhe Maut",
  locale: "en_IN",
  twitter: "@bunnyTheRobo001",
} as const;

export const ARTIST = {
  name: "Seedhe Maut",
  members: ["Encore ABJ", "Calm"],
  origin: "New Delhi, India",
  genres: ["Hip Hop", "Indian Hip Hop", "Desi Hip Hop", "Rap"],
  spotify: "https://open.spotify.com/artist/2oBG74gAocPMFv6Ij9ykdo",
  youtube: "https://music.youtube.com/@SeedheMaut",
  wikipedia: "https://en.wikipedia.org/wiki/Seedhe_Maut",
  instagram: "https://www.instagram.com/seedhemaut/",
} as const;

/**
 * Terms we can realistically compete on. Deliberately long-tail: the bare
 * "seedhe maut" SERP belongs to Spotify, YouTube and Wikipedia, and markup does
 * not beat domain authority.
 */
export const KEYWORDS = [
  "Seedhe Maut player",
  "listen to Seedhe Maut",
  "Seedhe Maut online",
  "Seedhe Maut radio",
  "Seedhe Maut songs",
  "Seedhe Maut playlist",
  "Seedhe Maut all songs",
  "play Seedhe Maut",
  "Seedhe Maut music player",
  "Seedhe Maut web player",
  "Encore ABJ",
  "Calm rapper",
  "SMX",
  "Desi hip hop player",
  "Indian hip hop radio",
  "न ज़मीन न आसमां",
  "Bayaan Seedhe Maut",
  "Lunch Break Seedhe Maut",
] as const;

export const DESCRIPTION =
  "A full-screen web player that plays only Seedhe Maut. Hit play and get a random track from the whole catalogue — Bayaan, न ज़मीन न आसमां, Lunch Break and more — with album-reactive visuals and no feed, no algorithm, no distractions.";

/** Absolute URL helper — metadata and JSON-LD both need fully-qualified URLs. */
export const abs = (path = "/"): string =>
  new URL(path, SITE.url).toString();

/**
 * Next does not inherit `openGraph.images` into segments that declare their own
 * `openGraph`, so every page spreads this in explicitly.
 */
export const OG_IMAGE = {
  url: abs("/og.png"),
  width: 1200,
  height: 630,
  alt: "Seedhe Maut Player — a full-screen radio that plays only Seedhe Maut",
} as const;
