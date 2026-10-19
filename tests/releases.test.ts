import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeRelease, handleApi } from "../cloudflare/api";

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

test("returns actionable errors when GitHub has no release or rate limits requests", async () => {
  const request = new Request("https://reader.example/api/releases");
  for (const status of [404, 403, 429]) {
    const response = await handleApi(request, {}, async () => new Response("", { status }));
    assert.equal(response.status, status === 404 ? 404 : 503);
    assert.match((await response.json()).error, status === 404 ? /release/i : /GitHub/i);
  }
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
