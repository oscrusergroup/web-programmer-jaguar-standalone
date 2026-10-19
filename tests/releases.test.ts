import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeRelease, handleApi, type ReleaseStore } from "../cloudflare/api";
import type { FirmwareRelease } from "../src/lib/release";

const tag = "v1.0.0";
const asset = (name: string) => ({
  name, size: 200, digest: "sha256:" + "a".repeat(64),
  browser_download_url: `https://github.com/oscrusergroup/firmware-jaguar-standalone/releases/download/${tag}/${name}`,
});
const release = {
  tag_name: tag, name: tag, published_at: "2026-10-02T05:54:06Z",
  html_url: `https://github.com/oscrusergroup/firmware-jaguar-standalone/releases/tag/${tag}`,
  draft: false, prerelease: false,
  assets: [asset("jaguarcartreader-mega2560.hex"), asset("jag.txt")],
};
const downloadBody = ":00000001FF\n";
const downloadHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(downloadBody))), (byte) => byte.toString(16).padStart(2, "0")).join("");
const downloadRelease = { ...release, assets: [{ ...release.assets[0], size: downloadBody.length, digest: `sha256:${downloadHash}` }, release.assets[1]] };

test("latest release exposes tag-pinned same-origin firmware and SD downloads", () => {
  const result = normalizeRelease(release);
  assert.equal(result.tag, tag);
  assert.equal(result.firmware.url, "/api/assets?tag=v1.0.0&file=jaguarcartreader-mega2560.hex");
  assert.equal(result.database?.name, "jag.txt");
  assert.equal(result.firmware.sha256, "a".repeat(64));
});

test("rejects prereleases, missing firmware, malformed assets and foreign download URLs", () => {
  assert.throws(() => normalizeRelease({ ...release, prerelease: true }), /stable/i);
  assert.throws(() => normalizeRelease({ ...release, assets: [] }), /firmware/i);
  assert.throws(() => normalizeRelease({ ...release, assets: [{ ...asset("jaguarcartreader-mega2560.hex"), size: 10_000_000 }] }), /size/i);
  assert.throws(() => normalizeRelease({ ...release, assets: [{ ...asset("jaguarcartreader-mega2560.hex"), browser_download_url: "https://evil.example/firmware.hex" }] }), /URL/i);
});

test("database is optional when a release has only firmware", () => {
  assert.equal(normalizeRelease({ ...release, assets: [release.assets[0]] }).database, null);
});

test("returns actionable errors when GitHub has no release or rate limits requests", async (context) => {
  const warn = context.mock.method(console, "warn", () => {});
  const request = new Request("https://reader.example/api/releases");
  for (const status of [404, 403, 429]) {
    const response = await handleApi(request, {}, async () => new Response("", { status }));
    assert.equal(response.status, status === 404 ? 404 : 503);
    assert.match((await response.json()).error, status === 404 ? /release/i : /GitHub/i);
  }
  assert.equal(warn.mock.callCount(), 2);
});

function memoryStore(initial: FirmwareRelease | null = null): ReleaseStore & { saved: FirmwareRelease | null } {
  return { saved: initial, async get() { return this.saved; }, async put(value) { this.saved = value; } };
}

test("serves the last good release and logs GitHub's rate-limit headers when GitHub fails", async (context) => {
  const warn = context.mock.method(console, "warn", () => {});
  const store = memoryStore();
  const request = new Request("https://reader.example/api/releases");
  const fresh = await handleApi(request, {}, async () => Response.json(release), store);
  assert.equal(fresh.status, 200);
  assert.equal(store.saved?.tag, tag);

  const limited = new Response("", { status: 403, headers: { "x-ratelimit-limit": "60", "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1792437187", "x-ratelimit-resource": "core" } });
  const fallback = await handleApi(request, { GITHUB_TOKEN: "token" }, async () => limited, store);
  assert.equal(fallback.status, 200);
  assert.equal(fallback.headers.get("X-Release-Source"), "fallback");
  assert.equal(fallback.headers.get("Cache-Control"), "public, max-age=60");
  assert.equal((await fallback.json()).tag, tag);
  const [, details] = warn.mock.calls[0].arguments as [string, { status: number; authenticated: boolean; rateLimit: Record<string, string | null> }];
  assert.equal(details.status, 403);
  assert.equal(details.authenticated, true);
  assert.equal(details.rateLimit.remaining, "0");
  assert.equal(details.rateLimit.reset, "2026-10-19T19:13:07.000Z");

  const offline = await handleApi(request, {}, async () => { throw new TypeError("network down"); }, store);
  assert.equal(offline.status, 200);
  assert.equal(offline.headers.get("X-Release-Source"), "fallback");
});

test("does not fall back for a missing release or a different asset tag", async (context) => {
  context.mock.method(console, "warn", () => {});
  const store = memoryStore(normalizeRelease(release));
  const missing = await handleApi(new Request("https://reader.example/api/releases"), {}, async () => new Response("", { status: 404 }), store);
  assert.equal(missing.status, 404);
  const otherTag = await handleApi(new Request("https://reader.example/api/assets?tag=v0.9.0&file=jag.txt"), {}, async () => new Response("", { status: 503 }), store);
  assert.equal(otherTag.status, 503);
});

test("downloads the saved release's assets while GitHub's API is unavailable", async (context) => {
  context.mock.method(console, "warn", () => {});
  const store = memoryStore(normalizeRelease(downloadRelease));
  const response = await handleApi(new Request("https://reader.example/api/assets?tag=v1.0.0&file=jaguarcartreader-mega2560.hex"), {}, async (input) =>
    String(input).includes("api.github.com") ? new Response("", { status: 429 }) : new Response(downloadBody), store);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Release-Source"), "fallback");
  assert.equal(await response.text(), downloadBody);
});

test("asset requests are pinned to selected tag and cannot proxy arbitrary files", async () => {
  const requested: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    return url.includes("api.github.com")
      ? Response.json(downloadRelease)
      : new Response(downloadBody);
  };
  const response = await handleApi(new Request("https://reader.example/api/assets?tag=v1.0.0&file=jaguarcartreader-mega2560.hex"), {}, fetcher);
  assert.equal(response.status, 200);
  assert.match(requested[0], /releases\/tags\/v1.0.0$/);
  assert.equal(requested[1], release.assets[0].browser_download_url);
  for (const query of ["tag=v1.0.0&file=evil.hex", "file=jag.txt", "tag=../../secrets&file=jag.txt"]) {
    const bad = await handleApi(new Request(`https://reader.example/api/assets?${query}`), {}, fetcher);
    assert.equal(bad.status, 400);
  }
  const method = await handleApi(new Request("https://reader.example/api/releases", { method: "POST" }), {}, fetcher);
  assert.equal(method.status, 405);
});

test("failed asset downloads do not produce a successful firmware response", async () => {
  let calls = 0;
  const response = await handleApi(new Request("https://reader.example/api/assets?tag=v1.0.0&file=jaguarcartreader-mega2560.hex"), {}, async () => ++calls === 1 ? Response.json(release) : new Response("", { status: 502 }));
  assert.equal(response.status, 502);
});

test("rejects truncated or corrupted asset bytes before serving firmware or database downloads", async () => {
  for (const file of ["jaguarcartreader-mega2560.hex", "jag.txt"]) {
    for (const body of [downloadBody.slice(0, -1), downloadBody.replace("FF", "FE")]) {
      let calls = 0;
      const metadata = { ...downloadRelease, assets: [{ ...downloadRelease.assets[0], name: file, browser_download_url: `${release.html_url.replace("/tag/", "/download/")}/${file}` }, ...(file === "jag.txt" ? [downloadRelease.assets[0]] : [])] };
      const response = await handleApi(new Request(`https://reader.example/api/assets?tag=v1.0.0&file=${file}`), {}, async () => ++calls === 1 ? Response.json(metadata) : new Response(body));
      assert.equal(response.status, 502);
      assert.match((await response.json()).error, /incomplete|integrity/i);
    }
  }
});
