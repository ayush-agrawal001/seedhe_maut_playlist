/** Format seconds as m:ss */
export function fmt(s: number): string {
  s = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Format milliseconds as m:ss */
export const fmtMs = (ms: number): string => fmt((ms || 0) / 1000);
