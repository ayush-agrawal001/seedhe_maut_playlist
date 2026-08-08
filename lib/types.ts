/** Shapes returned by the API — shared by server and client. */

export interface TrackSource {
  spotify: { id: string; url: string; uri: string } | null;
  /** Playback happens through the official YouTube IFrame player. */
  youtube: { videoId: string; url: string; embeddable: boolean } | null;
}

export interface ApiTrack extends TrackSource {
  /** Stable id: `sp:<spotifyId>` or `yt:<videoId>`. */
  id: string;
  title: string;
  /** Display string, e.g. "Seedhe Maut, Yashraj". */
  artists: string;
  album: string;
  albumId: string;
  year: number;
  durationMs: number;
  cover: string;
  coverSmall: string;
  explicit: boolean;
  popularity: number | null;
}

export interface ApiAlbum {
  id: string;
  name: string;
  year: number;
  cover: string;
  trackCount: number;
  spotifyUrl: string | null;
}

export interface CatalogMeta {
  artist: string;
  artistId: string | null;
  totalTracks: number;
  totalAlbums: number;
  playableOnYouTube: number;
  /** ISO timestamp of when the catalog was built. */
  fetchedAt: string;
  sources: string[];
  /** Present when a source failed and the catalogue is partial. */
  degraded?: string[];
}

export interface TracksResponse {
  meta: CatalogMeta;
  tracks: ApiTrack[];
}

export interface AlbumsResponse {
  meta: CatalogMeta;
  albums: ApiAlbum[];
}

export interface RandomResponse {
  track: ApiTrack;
  /** Ids excluded from this draw (previously played). */
  excluded: string[];
  poolSize: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
