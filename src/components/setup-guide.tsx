import { Cable, Monitor, HardDrive, CircleHelp, ExternalLink } from "lucide-react";
import { REPOSITORY } from "@/lib/release";
import { heading1, inlineCode, textLink } from "./styles";

const card = "rounded-xl border border-line bg-panel p-6";
const cardIcon = "mb-5 text-link";
const cardTitle = "text-lg font-bold tracking-tight";
const bodyText = "text-sm leading-loose text-muted";
const detail = "border-t border-line py-3.5";
const summary = "cursor-pointer text-sm font-semibold";
const answer = `mt-3 max-w-3xl ${bodyText}`;

export function SetupGuide() {
  return <section className="pt-9 pb-12 sm:pt-14" aria-labelledby="guide-heading">
    <div><span className="mb-4.5 block text-sm font-semibold text-accent">Before you begin</span><h1 id="guide-heading" className={heading1}>A little preparation.<br/>A smooth update.</h1><p className="mt-5 mb-8 text-muted">Everything you need to get your Jaguar reader ready.</p></div>
    <div className="grid gap-3.5 sm:grid-cols-3 sm:gap-5">
      <article className={card}><Monitor size={25} className={cardIcon}/><h2 className={cardTitle}>Open a compatible browser</h2><p className={bodyText}>Use Chrome or Microsoft Edge on a desktop computer. USB programming needs Web Serial and a secure connection (HTTPS or localhost).</p></article>
      <article className={card}><Cable size={25} className={cardIcon}/><h2 className={cardTitle}>Connect your Mega 2560</h2><p className={bodyText}>Connect the reader’s Arduino Mega 2560 with a USB data cable. Close Arduino IDE, serial monitors, and any other app using the port.</p></article>
      <article className={card}><HardDrive size={25} className={cardIcon}/><h2 className={cardTitle}>Prepare the SD card</h2><p className={bodyText}>Download the release’s game database and copy <code className={inlineCode}>jag.txt</code> to the root of your SD card. Flashing firmware doesn’t copy files to the card.</p></article>
    </div>
    <div className="mt-8 rounded-xl border border-line bg-panel p-5.5 sm:p-7"><div className="mb-4 flex items-center gap-3"><CircleHelp size={22}/><h2 className="text-xl font-bold tracking-tight">Something not connecting?</h2></div>
      <details open className={detail}><summary className={summary}>The device doesn’t appear in the USB picker</summary><p className={answer}>Try another USB data cable or USB port. Some cables provide power only. Clone boards may need the USB-to-serial driver supplied by their manufacturer. Select the Mega’s serial port in the browser’s device picker.</p></details>
      <details className={detail}><summary className={summary}>The bootloader times out</summary><p className={answer}>Close any app using the serial port, unplug and reconnect the reader, then select it again. The uploader requires the standard Arduino Mega 2560 bootloader. If automatic reset fails, press the board’s reset button as the upload starts.</p></details>
      <details className={detail}><summary className={summary}>The upload fails or the cable is unplugged</summary><p className={answer}>Reconnect the board and upload again. A failed upload can leave incomplete firmware; the app only reports success after full readback verification. The bootloader is preserved, so you can retry.</p></details>
      <details className={detail}><summary className={summary}>The latest firmware isn’t loading</summary><p className={answer}>Check your internet connection and refresh the release. GitHub may temporarily limit requests. Your deployment can use a server-side GitHub token to increase its request allowance.</p></details>
      <a className={`${textLink} mt-5 inline-flex items-center gap-2 text-xs`} href={REPOSITORY} target="_blank" rel="noreferrer">Read the project documentation <ExternalLink size={14}/></a>
    </div>
  </section>;
}
