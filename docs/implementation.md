# Jaguar Web Programmer

Build a Next.js and Tailwind CSS app to install the latest stable release from
breyell/jaguarcartreader onto its Arduino Mega 2560, deployable on Cloudflare.

## Design

Next.js produces a static export. A Cloudflare Worker serves it and provides
same-origin release and asset endpoints. The release is resolved at runtime,
cached for five minutes, and pinned to its tag for the entire upload. Only the
repository's Mega HEX and jag.txt release assets may be fetched. GitHub credentials
are optional and remain server-side. The browser checks the published SHA-256
digest and Intel HEX checksums before opening the serial port.

Web Serial communicates with the stock Mega 2560 STK500v2 bootloader at 115200
baud. Check the ATmega2560 signature before writing 256-byte application pages;
protect the 8 KiB bootloader; verify every written byte; release serial streams
and the port on success and failure. Device selection is distinct from an open
connection. Users explicitly start an upload. A physical device acceptance test
remains necessary before claiming hardware compatibility.

The interface uses white, slate (#182B3A), mist (#F3F6F8), steel (#607383), red
(#CB373F), and green (#23816A). System sans-serif type keeps the static build
independent of external font services. A custom Mega board illustration anchors
the page. A numbered firmware/device/upload flow reflects the actual sequence.
Browser support, network failures, unplugging, and retry instructions are visible.
The SD database download explains that jag.txt goes in the SD card's root.

## Implementation and verification

1. Set up the static Next.js export, Tailwind, Worker and local API proxy.
2. Reuse the neighboring project's Intel HEX parser, STK500v2 protocol and serial
   transport, along with simulator tests. Run tests before and after integration.
3. Add release validation and same-origin asset proxy; test missing releases,
   missing firmware, upstream failures, tag pinning, and invalid requests.
4. Build the responsive programmer UI with browser capability detection,
   disconnect handling, progress, live activity and recovery paths.
5. Run all tests, type checking, production export and Wrangler packaging.
   Inspect desktop/mobile UI and guide/activity interactions; test uploads using
   the serial protocol simulator.
6. Document local startup, deployment, optional token configuration and hardware
   verification. Leave publishing to the user's Cloudflare deployment process.
