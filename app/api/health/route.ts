import { cacheStats } from "@/lib/server/cache";
import { env, hasSpotify, hasYouTube, missingConfig } from "@/lib/server/env";
import { json, preflight } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req);
}

/**
 * GET /api/health — configuration status. Reports only whether credentials are
 * present, never their values.
 */
export function GET(req: Request) {
  const missing = missingConfig();
  return json(
    req,
    {
      status: hasSpotify() || hasYouTube() ? "ok" : "not_configured",
      services: {
        spotify: hasSpotify() ? "configured" : "missing_credentials",
        youtube: hasYouTube() ? "configured" : "missing_credentials",
      },
      missingEnv: missing,
      config: {
        artist: env.artistName,
        market: env.spotify.market,
        cacheTtlSeconds: env.cache.ttl,
        rateLimit: `${env.rateLimit.max} req / ${env.rateLimit.windowMs / 1000}s`,
      },
      cache: cacheStats(),
      uptimeSeconds: Math.round(process.uptime()),
    },
    { status: 200 }
  );
}
