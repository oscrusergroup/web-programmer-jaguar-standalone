# Jaguar Reader Web Programmer

A Next.js 16 + React 19 + Tailwind CSS 4 app that flashes the latest stable
[breyell/jaguarcartreader](https://github.com/breyell/jaguarcartreader) release
onto an **Arduino Mega 2560 (ATmega2560)** from a desktop browser.

## Run locally

Requires Node.js 22 or newer and pnpm 12.8.1 (pinned in `package.json`).

```sh
pnpm install
pnpm run dev
```

Open **http://localhost:3000**. The dev command runs Next.js on port 3000 and the
Cloudflare API on port 8787, with `/api/*` proxied through Next. It stops both
servers when interrupted. You can also run `pnpm run dev:web` and `pnpm run dev:api`
in separate terminals.

## Deploy on Cloudflare Workers

The Next.js app exports static HTML, CSS and JavaScript to `out/`. A small Worker
serves these files and handles release downloads. No OpenNext adapter, Node
server, database, container, or firmware compilation service is needed.

```sh
pnpm exec wrangler login
pnpm run deploy
```

The deploy script builds Next.js and publishes the Worker and its assets using
`wrangler.jsonc`. The default name is `jaguar-web-programmer`; change it before
deploying if needed. Wrangler prints the HTTPS URL when publishing succeeds.

For Cloudflare Git builds, use `pnpm run build` as the build command and
`pnpm exec wrangler deploy` as the deploy command, with the repository root as the
root directory. This project targets **Workers with Static Assets**. Plain
static hosting of `out/` alone will not provide the release API.

To test the production build locally or package it without publishing:

```sh
pnpm run preview
pnpm run deploy:check
```

The API caches successful responses at the edge for five minutes. It resolves
the latest stable release at runtime, so firmware updates do **not** require
rebuilding the web app. An upload and its database download stay pinned to the
tag shown on screen.

### Optional GitHub token

Public downloads work without a token. GitHub's unauthenticated API rate limits
are shared by requests from the same address; a token can raise the allowance.
No repository write permission is needed for this public repository.

```sh
pnpm exec wrangler secret put GITHUB_TOKEN
```

For local development, copy `.dev.vars.example` to `.dev.vars` and set the token
there. Tokens stay in the Worker; never use a `NEXT_PUBLIC_` variable for them.

## Program a reader

1. Open the app in **desktop Chrome or Microsoft Edge** over HTTPS or localhost.
2. Connect the reader's Mega 2560 using a **USB data cable**.
3. Check the latest release, then select the Arduino serial port.
4. Close Arduino IDE, serial monitors, and other apps using the port. Confirm
   this in the app, then click **Install firmware**.
5. Keep the tab open and USB connected until the app reports verification success.
6. Download **jag.txt** and copy it to the **root of the reader's SD card**.

The app requires a standard Arduino Mega 2560 bootloader already installed.
It checks the ATmega2560 signature before writing; different chips are rejected.
USB clones are supported by allowing all serial ports in the picker, although
their USB-to-serial adapter may need an OS driver. Device selection alone does
not confirm the chip type or prove the port can be opened.

## Firmware integrity and uploader

The Worker only serves `jaguarcartreader-mega2560.hex` and `jag.txt` from this
repository's stable release assets. It validates the tag, asset sizes, and
download origins, then checks the actual byte count and published SHA-256 before
serving or caching either file. GitHub errors produce actionable API errors rather than a
firmware-shaped response.

Before the browser opens or resets the board, it checks download size, the
published SHA-256 digest when available, and Intel HEX record checksums. The
parser supports extended addresses and rejects writes to the Mega's 8 KiB
bootloader region. The STK500v2 uploader runs at 115200 baud, checks the chip,
writes 256-byte pages, reads every page back, and only reports success after
verification and leaving programming mode. It does not write EEPROM or fuses.

The app closes the port and releases stream locks on both success and failure.
An interrupted upload may leave incomplete application firmware. Reconnect and
retry; the protected bootloader allows a new upload. The in-app setup guide
includes instructions for timeouts, unsupported browsers and missing devices.

## Verification

```sh
pnpm test
pnpm run typecheck
pnpm run deploy:check
```

The suite exercises extended HEX addresses, bootloader protection, bad
checksums, wrong chip signatures, full readback verification, corrupt replies,
serial fragmentation/timeouts/disconnects, stream cleanup, asset origin checks,
release tag pinning, missing releases, GitHub failures, and download integrity.
The protocol simulator includes firmware above 128 KiB.

The v1.0.0 release files were downloaded through the local Worker, their
published SHA-256 digests matched, and the actual firmware parsed to 42,496
bytes (166 pages). Desktop and mobile layouts and guide/activity interactions
were checked in a browser. **A physical Mega 2560 upload has not been verified.**

Before relying on the app for hardware use, perform one full upload to a reader,
confirm it boots and its OLED/menu works, copy jag.txt to SD, and check a ROM
read. Also check that a disconnected USB cable produces a recoverable error.

The uploader and its protocol tests were adapted from the neighboring
`cartreader-web-programmer` project in this workspace.

## References

- [Firmware repository and release assets](https://github.com/breyell/jaguarcartreader)
- [Arduino Mega STK500v2 bootloader source](https://github.com/arduino/ArduinoCore-avr/tree/master/bootloaders/stk500v2)
- [Chrome Web Serial documentation](https://developer.chrome.com/docs/capabilities/serial)
- [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
