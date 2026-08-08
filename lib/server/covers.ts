import "server-only";

/**
 * Local album artwork, used while Spotify is unavailable.
 *
 * YouTube only gives us video thumbnails (frames from the video), which look
 * like stills rather than album covers. These are the real sleeves, matched to
 * a song by keyword where possible.
 *
 * Once Spotify is reachable it supplies exact per-track artwork and none of
 * this is used.
 */

export interface LocalAlbum {
  album: string;
  cover: string;
  /** Lowercase substrings that identify this album in a video title. */
  keys: string[];
}

export const LOCAL_ALBUMS: LocalAlbum[] = [
  {
    album: "न ज़मीन न आसमां",
    cover: "/covers/na.png",
    keys: ["न ज़मीन", "na zameen", "nazameen", "zameen", "aasmaan", "asmaan", "nzna"],
  },
  { album: "Bayaan", cover: "/covers/bayaan.jpg", keys: ["bayaan", "bayan"] },
  { album: "Lunch Break", cover: "/covers/lunch_break.png", keys: ["lunch break", "lunchbreak"] },
  { album: "Nayaab", cover: "/covers/nayaab.jpg", keys: ["nayaab", "nayab"] },
  { album: "DL 91FM", cover: "/covers/dl91fm.png", keys: ["dl91", "dl 91", "91fm", "shakti"] },
  { album: "Kshama", cover: "/covers/kshama.jpg", keys: ["kshama"] },
];

/** Stable hash so an unmatched song always gets the same sleeve. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export interface CoverPick {
  album: string;
  cover: string;
  /** false when the album was guessed rather than identified from the title. */
  exact: boolean;
}

/**
 * Picks album art for a YouTube video. Falls back to a deterministic sleeve
 * from the same artist so the UI shows real artwork instead of a video frame.
 */
export function pickLocalCover(title: string, videoId: string): CoverPick {
  const t = title.toLowerCase();
  for (const a of LOCAL_ALBUMS) {
    if (a.keys.some((k) => t.includes(k))) {
      return { album: a.album, cover: a.cover, exact: true };
    }
  }
  const a = LOCAL_ALBUMS[hash(videoId) % LOCAL_ALBUMS.length]!;
  return { album: a.album, cover: a.cover, exact: false };
}
