import type { ApiErrorBody, ApiTrack, RandomResponse, TracksResponse } from "./types";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    let code = "http_error";
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as ApiErrorBody;
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(code, message, res.status);
  }
  return res.json() as Promise<T>;
}

/** All tracks that can be played through the official YouTube player. */
export const fetchTracks = (signal?: AbortSignal): Promise<TracksResponse> =>
  get<TracksResponse>("/api/tracks?playable=true", signal);

/** A random track, avoiding the recently played ids (most recent first). */
export function fetchRandom(recent: string[], signal?: AbortSignal): Promise<RandomResponse> {
  const qs = recent.length ? `?exclude=${encodeURIComponent(recent.join(","))}` : "";
  return get<RandomResponse>(`/api/random${qs}`, signal);
}

export const trackKey = (t: ApiTrack): string => t.id;
