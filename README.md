# Seedhe Maut Player — Next.js + TypeScript

A full-screen random-discovery player for Seedhe Maut. Metadata and artwork come
from the **Spotify Web API**; playback runs through the **official YouTube
IFrame Player**. Backend and frontend ship as one deployable Next.js app.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the keys below
npm run dev
```

Open http://localhost:3000 · check config at http://localhost:3000/api/health

Without credentials the app still runs and tells you exactly what's missing —
every endpoint returns a clean `503 not_configured`.

---

## Getting the credentials

### Spotify (metadata, albums, artwork)
1. https://developer.spotify.com/dashboard → **Create app** (redirect URI can be
   anything; it is unused).
2. Copy the **Client ID** and **Client Secret** into `.env.local`.

Uses the **Client Credentials** flow — app-level auth only. No user login, and
Spotify is never used for playback.

> **Development-mode limits.** Until an app is quota-extended, Spotify:
> - **403s** the batch endpoints — `/albums?ids=…`, `/artists/{id}/top-tracks`,
>   `/artists/{id}/related-artists`
> - **400s "Invalid limit"** on any explicit `limit` param, forcing a small page size
> - requires the app owner to hold **Spotify Premium** (otherwise every call
>   403s with "Active premium subscription required")
>
> `lib/server/spotify.ts` is written around all three: no `limit` is sent, paging
> walks `offset` directly, and album tracks are fetched one album at a time.

### YouTube (playback ids)
1. https://console.cloud.google.com → new project.
2. **APIs & Services → Library →** enable **YouTube Data API v3**.
3. **Credentials → Create credentials → API key**. Restrict it to the YouTube
   Data API.
4. Set `YOUTUBE_CHANNEL_ID` to the official Seedhe Maut channel (`UC…`).

> **Why the channel id matters.** Enumerating a channel's uploads costs
> **1 quota unit per 50 videos**; `search.list` costs **100 units per call**.
> The default free quota is 10,000 units/day, so the whole catalogue is built
> for ~10 units instead of thousands. Search fallback is off by default.

---

## API

Base URL `/api`. All responses are JSON. Errors use a consistent envelope:

```jsonc
{ "error": { "code": "invalid_query", "message": "…", "details": { } } }
```

| Endpoint | Description |
|---|---|
| `GET /api/health` | Config status, cache stats, uptime. Never returns secret values. |
| `GET /api/tracks` | Full catalogue. `?album=<id>` `?playable=true` `?limit=1..200` `?offset=` |
| `GET /api/albums` | Albums with artwork and track counts. |
| `GET /api/random` | One random track. `?exclude=id1,id2` `?playable=false` |

### `GET /api/random`
Pass recently played ids (most recent first) as `exclude` — the picker skips
them, so **a song never repeats back-to-back**. If everything is excluded it
falls back to avoiding only the single most recent track. Never cached.

```bash
curl "http://localhost:3000/api/random?exclude=sp:abc123,sp:def456"
```

```jsonc
{
  "track": {
    "id": "sp:4uLU6hMCjMI75M1A2tKUQC",
    "title": "Nanchaku",
    "artists": "Seedhe Maut",
    "album": "न ज़मीन न आसमां",
    "albumId": "…", "year": 2024, "durationMs": 168000,
    "cover": "https://i.scdn.co/image/…",
    "coverSmall": "https://i.scdn.co/image/…",
    "explicit": true, "popularity": null,
    "spotify": { "id": "…", "url": "https://open.spotify.com/track/…", "uri": "spotify:track:…" },
    "youtube": { "videoId": "…", "url": "https://youtube.com/watch?v=…", "embeddable": true }
  },
  "excluded": ["sp:abc123", "sp:def456"],
  "poolSize": 42
}
```

### Status codes
`200` ok · `400` invalid query · `429` rate limited · `502` upstream failure ·
`503` not configured

---

## How playback works — and what this project does *not* do

Full songs play **only** through the official **YouTube IFrame Player API**.

Spotify's API cannot stream full tracks without Premium user OAuth and its
Web Playback SDK, so Spotify is used purely for metadata, artwork and
"open in Spotify" links — exactly as its terms intend.

This project does **not** download audio, store MP3s, extract stream URLs,
proxy audio, touch DRM, scrape private endpoints, or work around any playback
restriction. Nothing but public, documented APIs.

> ⚠️ **Read before deploying publicly.** YouTube's API Terms of Service require
> the player to stay visible (at least 200x200) while media plays, and forbid
> audio-only playback.
>
> The UI ships with the video **off by default** (`videoOn = false` in
> `components/PlayerShell.tsx`). In that state the player stays mounted but
> off-screen so audio keeps running, which does **not** meet the requirement.
> This is fine for local/personal use; before running this on a public domain,
> flip `videoOn` to `true` so the player is visible whenever media plays.

---

## Architecture

```
app/
  page.tsx                 server component -> <PlayerShell/>
  api/health/route.ts      config status
  api/tracks/route.ts      catalogue (paged, filterable)
  api/albums/route.ts      album list
  api/random/route.ts      random pick with no-repeat
lib/
  types.ts                 API response types (shared server + client)
  api.ts                   typed client-side fetchers
  server/
    env.ts                 config; nothing here is NEXT_PUBLIC_
    spotify.ts             Client Credentials, token cache, 429 retry
    youtube.ts             uploads enumeration + title matching
    catalog.ts             merges both sources, random picker
    cache.ts               TTL cache with in-flight de-duplication
    rate-limit.ts          per-IP fixed window
    http.ts                JSON/CORS/validation/error mapping
hooks/
  useCatalogPlayer.ts      catalogue + playback state + no-repeat history
  useYouTubePlayer.ts      official IFrame Player wrapper
components/                Background · TopBar · Hero · YouTubeStage · Player · Queue
```

**Credential safety.** Every secret is read in `lib/server/*`, which is imported
only by route handlers and marked `import "server-only"` — the build fails if
any of it is pulled into a client bundle. No key is prefixed `NEXT_PUBLIC_`, so
nothing reaches the browser. The browser only ever talks to your own `/api/*`.

**Caching.** The merged catalogue is cached in memory for `CACHE_TTL_SECONDS`
(6h default) with in-flight de-duplication, so a cold start with concurrent
visitors makes exactly one upstream call. `/api/tracks` and `/api/albums` also
send `Cache-Control: s-maxage` for CDN reuse. `/api/random` is never cached.

**Rate limiting.** Per-IP fixed window (`60 req/min` default), returning
`X-RateLimit-*` headers and `Retry-After` on 429.

**CORS.** Off by default (same-origin). Set `ALLOWED_ORIGINS` to a
comma-separated list, or `*`. `OPTIONS` preflight is handled on every route.

---

## Deploying

Works on any Node host. **Vercel:** import the repo, add the env vars from
`.env.example` in *Project → Settings → Environment Variables*, deploy.

```bash
npm run build && npm start
```

Two things to change for multi-instance / serverless production:

- **Rate limiting** is per-instance in-memory. Swap `lib/server/rate-limit.ts`
  for a shared store (Upstash Redis, `@vercel/kv`) so limits are global.
- **Caching** is likewise per-instance. That's usually fine given the CDN
  headers, but a shared cache avoids each instance rebuilding the catalogue.

---

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | — | Required for metadata |
| `SPOTIFY_ARTIST_ID` | `2oBG74…` | Skips an artist lookup |
| `SPOTIFY_MARKET` | `IN` | Track availability market |
| `YOUTUBE_API_KEY` | — | Required for playback ids |
| `YOUTUBE_CHANNEL_ID` | — | Strongly recommended (quota) |
| `YOUTUBE_ALLOW_SEARCH` | `false` | Enable costly `search.list` fallback |
| `CACHE_TTL_SECONDS` | `21600` | Catalogue cache lifetime |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `60` / `60000` | Per-IP limit |
| `ALLOWED_ORIGINS` | *(empty)* | CORS allow-list; empty = same-origin |

---

## Customising

- **Logo** — `public/assets/logo.png` (transparent PNG). Size via `.hero__logo`.
- **Artist** — change `SPOTIFY_ARTIST_ID`, `YOUTUBE_CHANNEL_ID`, `ARTIST_NAME`.
  Nothing else is hardcoded.
- **Title matching** — `normalizeTitle` / `matchVideo` in
  `lib/server/youtube.ts`; lower `minScore` if songs aren't matching.
