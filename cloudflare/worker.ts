import { handleApi, type ApiEnv } from "./api";
interface Env extends ApiEnv { ASSETS: { fetch(request: Request): Promise<Response> } }
interface Context { waitUntil(promise: Promise<unknown>): void }
export default {
  async fetch(request: Request, env: Env, context: Context): Promise<Response> {
    if (!new URL(request.url).pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const cache = (caches as CacheStorage & { default: Cache }).default;
    if (request.method === "GET") {
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    const response = await handleApi(request, env);
    if (response.ok) context.waitUntil(cache.put(request, response.clone()));
    return response;
  },
};
