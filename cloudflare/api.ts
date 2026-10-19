import { FIRMWARE_NAME, REPOSITORY, type FirmwareRelease, type ReleaseAsset } from "../src/lib/release";

const API = "https://api.github.com/repos/oscrusergroup/firmware-jaguar-standalone";
const MAX_ASSET_SIZE = 1_048_576;
const validTag = (tag: string) => /^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,99}$/.test(tag);
type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("GitHub returned invalid release metadata.");
  return value as ObjectValue;
}
export function normalizeRelease(value: unknown): FirmwareRelease {
  const release = object(value);
  if (release.draft || release.prerelease) throw new Error("A stable published release is required.");
  const rawTag = release.tag_name;
  if (typeof rawTag !== "string" || !validTag(rawTag)) throw new Error("Release tag is invalid.");
  const tag: string = rawTag;
  const url = `${REPOSITORY}/releases/tag/${encodeURIComponent(tag)}`;
  if (release.html_url !== url || typeof release.published_at !== "string" || !Number.isFinite(Date.parse(release.published_at))) throw new Error("Release metadata is incomplete.");
  const assets = Array.isArray(release.assets) ? release.assets.map(object) : [];
  function asset(name: string): ReleaseAsset | null {
    const entry = assets.find((item) => item.name === name);
    if (!entry) return null;
    if (typeof entry.size !== "number" || !Number.isInteger(entry.size) || entry.size <= 0 || entry.size > MAX_ASSET_SIZE) throw new Error("Release asset size is invalid.");
    if (entry.browser_download_url !== `${REPOSITORY}/releases/download/${encodeURIComponent(tag)}/${name}`) throw new Error("Release asset URL is invalid.");
    if (entry.digest && (typeof entry.digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(entry.digest))) throw new Error("Release asset digest is invalid.");
    return {
      name, size: entry.size,
      sha256: typeof entry.digest === "string" ? entry.digest.slice(7) : null,
      url: `/api/assets?tag=${encodeURIComponent(tag)}&file=${name}`,
    };
  }
  const firmware = asset(FIRMWARE_NAME);
  if (!firmware) throw new Error("The latest release has no Mega 2560 firmware. Check the repository's release assets.");
  return { tag, name: typeof release.name === "string" ? release.name : tag,
    publishedAt: release.published_at, url, firmware, database: asset("jag.txt") };
}

class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export interface ApiEnv { GITHUB_TOKEN?: string }
export async function handleApi(request: Request, env: ApiEnv, fetcher: typeof fetch = fetch): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (request.method !== "GET") return Response.json({ error: "Use GET for release downloads." }, { status: 405, headers: { Allow: "GET" } });
    if (!["/api/releases", "/api/assets"].includes(url.pathname)) throw new ApiError("Endpoint not found.", 404);
    const isAsset = url.pathname === "/api/assets";
    const tag = url.searchParams.get("tag");
    const filename = url.searchParams.get("file");
    if (isAsset && (!tag || !validTag(tag) || ![FIRMWARE_NAME, "jag.txt"].includes(filename || ""))) throw new ApiError("Choose a valid release tag and supported firmware or database file.", 400);
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "jaguar-web-programmer", "X-GitHub-Api-Version": "2022-11-28" };
    if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const upstream = await fetcher(`${API}/releases/${isAsset ? `tags/${encodeURIComponent(tag!)}` : "latest"}`, { headers, signal: AbortSignal.timeout(15_000) });
    if (upstream.status === 404) throw new ApiError("No published firmware release was found. Check GitHub and try again.", 404);
    if (!upstream.ok) throw new ApiError("GitHub is temporarily unavailable or its request limit was reached. Wait a few minutes and retry.", 503);
    const release = normalizeRelease(await upstream.json());
    if (!isAsset) return Response.json(release, { headers: { "Cache-Control": "public, max-age=300" } });
    if (release.tag !== tag) throw new ApiError("The release tag changed. Refresh the release before downloading.", 409);
    const selected = filename === FIRMWARE_NAME ? release.firmware : release.database;
    if (!selected) throw new ApiError("This release does not include jag.txt.", 404);
    const download = await fetcher(`${REPOSITORY}/releases/download/${encodeURIComponent(tag!)}/${filename}`, { signal: AbortSignal.timeout(30_000), headers: { "User-Agent": "jaguar-web-programmer" } });
    if (!download.ok) throw new ApiError("GitHub could not provide the release file. Try the download again.", 502);
    const data = await download.arrayBuffer();
    if (data.byteLength > MAX_ASSET_SIZE) throw new ApiError("Release file exceeds the allowed size.", 502);
    if (data.byteLength !== selected.size) throw new ApiError("The release download is incomplete. Try again in a few minutes.", 502);
    if (selected.sha256) {
      const digest = await crypto.subtle.digest("SHA-256", data);
      const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      if (hex !== selected.sha256) throw new ApiError("The release file failed its integrity check. Refresh the release and retry.", 502);
    }
    return new Response(data, { headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Release request failed. Try again." }, { status: error instanceof ApiError ? error.status : 502 });
  }
}
