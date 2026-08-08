import "server-only";
import { env } from "./env";
import type { ApiErrorBody } from "@/lib/types";

/* ------------------------------- CORS ---------------------------------- */

function allowOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  const cfg = env.allowedOrigins;

  // No config -> same-origin only (no CORS headers emitted).
  if (!cfg) return null;
  if (cfg === "*") return "*";
  if (!origin) return null;

  const list = cfg.split(",").map((s) => s.trim()).filter(Boolean);
  return list.includes(origin) ? origin : null;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = allowOrigin(req);
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    ...(origin !== "*" ? { Vary: "Origin" } : {}),
  };
}

export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/* ------------------------------ Responses ------------------------------- */

interface JsonOpts {
  status?: number;
  headers?: Record<string, string>;
  /** Seconds for the CDN/browser Cache-Control header. */
  cacheSeconds?: number;
}

export function json<T>(req: Request, body: T, opts: JsonOpts = {}): Response {
  const { status = 200, headers = {}, cacheSeconds } = opts;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(cacheSeconds
        ? {
            "Cache-Control": `public, max-age=${Math.min(
              cacheSeconds,
              60
            )}, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
          }
        : { "Cache-Control": "no-store" }),
      ...corsHeaders(req),
      ...headers,
    },
  });
}

export function fail(
  req: Request,
  status: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } };
  return json(req, body, { status });
}

/* ------------------------------ Validation ------------------------------ */

export type Paging =
  | { ok: true; limit: number; offset: number }
  | { ok: false; error: string };

/** Parses ?limit / ?offset with sane bounds. */
export function parsePaging(url: URL, maxLimit = 200): Paging {
  const rawLimit = url.searchParams.get("limit");
  const rawOffset = url.searchParams.get("offset");

  const limit = rawLimit === null ? maxLimit : Number.parseInt(rawLimit, 10);
  const offset = rawOffset === null ? 0 : Number.parseInt(rawOffset, 10);

  if (Number.isNaN(limit) || limit < 1 || limit > maxLimit) {
    return { ok: false, error: `limit must be an integer between 1 and ${maxLimit}` };
  }
  if (Number.isNaN(offset) || offset < 0) {
    return { ok: false, error: "offset must be an integer >= 0" };
  }
  return { ok: true, limit, offset };
}

/** Parses a repeatable/comma-separated id param, e.g. ?exclude=a,b&exclude=c */
export function parseIdList(url: URL, name: string, max = 50): string[] {
  const out: string[] = [];
  for (const raw of url.searchParams.getAll(name)) {
    for (const part of raw.split(",")) {
      const v = part.trim();
      if (v && /^[\w:-]{1,64}$/.test(v) && !out.includes(v)) out.push(v);
      if (out.length >= max) return out;
    }
  }
  return out;
}

/* ------------------------------- Errors --------------------------------- */

export class UpstreamError extends Error {
  constructor(
    public service: "spotify" | "youtube",
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export class ConfigError extends Error {
  constructor(public missing: string[]) {
    super(`Missing configuration: ${missing.join(", ")}`);
    this.name = "ConfigError";
  }
}

/** Maps thrown errors onto clean JSON responses. */
export function handleError(req: Request, err: unknown): Response {
  if (err instanceof ConfigError) {
    return fail(req, 503, "not_configured", err.message, { missing: err.missing });
  }
  if (err instanceof UpstreamError) {
    const status = err.status === 429 ? 429 : 502;
    return fail(req, status, `${err.service}_error`, err.message, {
      upstreamStatus: err.status,
    });
  }
  console.error("[api] unhandled error:", err);
  return fail(req, 500, "internal_error", "Something went wrong.");
}
