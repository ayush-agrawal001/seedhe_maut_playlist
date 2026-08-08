import "server-only";

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();
/** De-duplicates concurrent misses so one cold start != N upstream calls. */
const inflight = new Map<string, Promise<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlSeconds: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * Returns the cached value, or computes and caches it. Concurrent callers for
 * the same key share a single in-flight promise.
 *
 * `ttlSeconds` may be a function of the resolved value, so a partial/degraded
 * result can be cached briefly while a healthy one is cached for the full TTL.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number | ((value: T) => number),
  fn: () => Promise<T>
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = (async () => {
    try {
      const value = await fn();
      const ttl = typeof ttlSeconds === "function" ? ttlSeconds(value) : ttlSeconds;
      cacheSet(key, value, ttl);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

export function cacheClear(prefix?: string): number {
  if (!prefix) {
    const n = store.size;
    store.clear();
    return n;
  }
  let n = 0;
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) {
      store.delete(k);
      n++;
    }
  }
  return n;
}

export function cacheStats() {
  return { entries: store.size, keys: [...store.keys()] };
}
