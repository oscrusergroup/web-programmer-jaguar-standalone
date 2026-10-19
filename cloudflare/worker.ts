import { handleApi, type ApiEnv, type ReleaseStore } from "./api";
import type { FirmwareRelease } from "../src/lib/release";
interface Env extends ApiEnv { ASSETS: { fetch(request: Request): Promise<Response> } }
interface Context { waitUntil(promise: Promise<unknown>): void }

// The Cache API is per data center and may evict early; it only has to bridge GitHub outages.
const LAST_GOOD_TTL = 30 * 24 * 60 * 60;
function lastGoodRelease(cache: Cache, origin: string): ReleaseStore {
  const key = new Request(new URL("/api/releases/last-good", origin));
  return {
    async get() {
      const saved = await cache.match(key);
      return saved ? await saved.json() as FirmwareRelease : null;
    },
    async put(release) {
      await cache.put(key, Response.json(release, { headers: { "Cache-Control": `public, max-age=${LAST_GOOD_TTL}` } }));
    },
  };
}

export default {
  async fetch(request: Request, env: Env, context: Context): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const cache = (caches as CacheStorage & { default: Cache }).default;
    if (request.method === "GET") {
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    const response = await handleApi(request, env, fetch, lastGoodRelease(cache, url.origin));
    if (response.ok) context.waitUntil(cache.put(request, response.clone()));
    return response;
  },
};
