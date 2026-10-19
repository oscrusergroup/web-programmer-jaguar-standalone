export const REPOSITORY = "https://github.com/oscrusergroup/firmware-jaguar-standalone";
export const FIRMWARE_NAME = "jaguarcartreader-mega2560.hex";
export interface ReleaseAsset {
  name: string;
  size: number;
  sha256: string | null;
  url: string;
}
export interface FirmwareRelease {
  tag: string;
  name: string;
  publishedAt: string;
  url: string;
  firmware: ReleaseAsset;
  database: ReleaseAsset | null;
}

export async function downloadFirmware(asset: ReleaseAsset): Promise<string> {
  const response = await fetch(asset.url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Firmware download failed. Check your connection and retry.");
  }
  const data = await response.arrayBuffer();
  if (data.byteLength !== asset.size) throw new Error("Firmware download is incomplete. Refresh the release and try again.");
  if (asset.sha256) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (hex !== asset.sha256) throw new Error("Firmware integrity check failed. Refresh the release and try again.");
  }
  return new TextDecoder().decode(data);
}
