/**
 * YouTube thumbnail quality fallback.
 *
 * `maxresdefault.jpg` (1280x720) doesn't exist for every video — YouTube only
 * generates it for uploads processed at sufficient resolution. Requesting a
 * missing one returns a 120x90 grey placeholder rather than a 404, which is
 * why a single-attempt probe isn't enough. `hqdefault.jpg` (480x360) is
 * generated for effectively every public video, so a maxres -> sd -> hq chain
 * almost always lands on a real image instead of falling back to black.
 *
 * Now that the video background is gone, the cover is the only visual behind
 * the whole app, so getting the best real thumbnail matters more than before.
 */

const YTIMG_RE = /^https:\/\/i\.ytimg\.com\/vi\/([\w-]+)\/\w+\.jpg(\?.*)?$/;

/** Ordered list of URLs to try for a cover; just the original for non-YouTube sources. */
export function coverCandidates(url: string): string[] {
  const m = YTIMG_RE.exec(url);
  if (!m) return url ? [url] : [];
  const id = m[1];
  return ["maxresdefault", "sddefault", "hqdefault"].map(
    (q) => `https://i.ytimg.com/vi/${id}/${q}.jpg`
  );
}

/** YouTube's placeholder for a missing thumbnail is a fixed 120x90 grey box. */
export const isPlaceholderImage = (img: HTMLImageElement): boolean =>
  img.naturalWidth <= 120 && img.naturalHeight <= 90;

/**
 * Tries each candidate in order (via a throwaway Image()), resolving the
 * first that loads as a real image, or null if every candidate fails.
 */
export function probeBestImage(candidates: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    let i = 0;
    const tryNext = () => {
      if (i >= candidates.length) {
        resolve(null);
        return;
      }
      const url = candidates[i++]!;
      const img = new Image();
      img.onload = () => (isPlaceholderImage(img) ? tryNext() : resolve(url));
      img.onerror = tryNext;
      img.src = url;
    };
    tryNext();
  });
}
