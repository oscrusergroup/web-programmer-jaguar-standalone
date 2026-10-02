import { Cable, Monitor, HardDrive, CircleHelp, ExternalLink } from "lucide-react";
import { REPOSITORY } from "@/lib/release";
export function SetupGuide() {
  return <section className="guide" aria-labelledby="guide-heading">
    <div className="guide-heading"><span className="eyebrow">Before you begin</span><h1 id="guide-heading">A little preparation.<br/>A smooth update.</h1><p>Everything you need to get your Jaguar reader ready.</p></div>
    <div className="guide-grid">
      <article className="guide-card"><Monitor size={25}/><h2>Open a compatible browser</h2><p>Use Chrome or Microsoft Edge on a desktop computer. USB programming needs Web Serial and a secure connection (HTTPS or localhost).</p></article>
      <article className="guide-card"><Cable size={25}/><h2>Connect your Mega 2560</h2><p>Connect the reader’s Arduino Mega 2560 with a USB data cable. Close Arduino IDE, serial monitors, and any other app using the port.</p></article>
      <article className="guide-card"><HardDrive size={25}/><h2>Prepare the SD card</h2><p>Download the release’s game database and copy <code>jag.txt</code> to the root of your SD card. Flashing firmware doesn’t copy files to the card.</p></article>
    </div>
    <div className="troubleshooting"><div className="flex items-center gap-3"><CircleHelp size={22}/><h2>Something not connecting?</h2></div>
      <details open><summary>The device doesn’t appear in the USB picker</summary><p>Try another USB data cable or USB port. Some cables provide power only. Clone boards may need the USB-to-serial driver supplied by their manufacturer. Select the Mega’s serial port in the browser’s device picker.</p></details>
      <details><summary>The bootloader times out</summary><p>Close any app using the serial port, unplug and reconnect the reader, then select it again. The uploader requires the standard Arduino Mega 2560 bootloader. If automatic reset fails, press the board’s reset button as the upload starts.</p></details>
      <details><summary>The upload fails or the cable is unplugged</summary><p>Reconnect the board and upload again. A failed upload can leave incomplete firmware; the app only reports success after full readback verification. The bootloader is preserved, so you can retry.</p></details>
      <details><summary>The latest firmware isn’t loading</summary><p>Check your internet connection and refresh the release. GitHub may temporarily limit requests. Your deployment can use a server-side GitHub token to increase its request allowance.</p></details>
      <a className="text-link mt-5 inline-flex items-center gap-2" href={REPOSITORY} target="_blank" rel="noreferrer">Read the project documentation <ExternalLink size={14}/></a>
    </div>
  </section>;
}
