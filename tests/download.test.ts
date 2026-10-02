import { test } from "node:test";
import assert from "node:assert/strict";
import { downloadFirmware, type ReleaseAsset } from "../src/lib/release";

const firmware = ":0400000001020304F2\n:00000001FF\n";
const data = new TextEncoder().encode(firmware);
const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)), (byte) => byte.toString(16).padStart(2, "0")).join("");
const asset: ReleaseAsset = { name: "firmware.hex", url: "https://reader.example/api/assets", size: data.length, sha256: digest };

test("downloads exact bytes and checks the published SHA-256 digest", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response(firmware));
  assert.equal(await downloadFirmware(asset), firmware);
  await assert.rejects(downloadFirmware({ ...asset, sha256: "0".repeat(64) }), /integrity/i);
});

test("rejects a truncated file and surfaces the proxy's upstream failure", async (context) => {
  const stub = context.mock.method(globalThis, "fetch", async () => new Response(firmware.slice(0, -1)));
  await assert.rejects(downloadFirmware(asset), /incomplete/i);
  stub.mock.mockImplementation(async () => Response.json({ error: "GitHub is temporarily unavailable." }, { status: 503 }));
  await assert.rejects(downloadFirmware(asset), /GitHub is temporarily unavailable/);
});
