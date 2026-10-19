"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDownToLine, ArrowUpRight, Check, ChevronDown, ChevronRight, CircleAlert, CircleCheck, Code2, Cpu, Github, LoaderCircle, PlugZap, RefreshCw, ShieldCheck, Terminal, Unplug, Usb, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { SetupGuide } from "./setup-guide";
import { downloadFirmware, REPOSITORY, type FirmwareRelease } from "@/lib/release";
import { parseHex } from "@/lib/serial/hex";
import { serialAPI, uploadFirmware, type SerialPort } from "@/lib/serial/web-serial";

type Entry = { time: string; message: string; kind: "info" | "error" | "success" };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
function ClawMark() {
  return <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true"><rect width="36" height="36" rx="10" fill="currentColor"/><path d="m8 25 7-15h4l-7 15zm8 0 7-15h4l-7 15zm8 0 7-15h3l-7 15z" fill="white" transform="translate(-2 0)"/></svg>;
}

export function Programmer() {
  const [view, setView] = useState<"programmer" | "guide">("programmer");
  const [release, setRelease] = useState<FirmwareRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const [releaseError, setReleaseError] = useState("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [port, setPort] = useState<SerialPort | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [percent, setPercent] = useState(0);
  const [phase, setPhase] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [success, setSuccess] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const portRef = useRef<SerialPort | null>(null);
  const busyRef = useRef(false);
  const releaseController = useRef<AbortController | null>(null);
  const lastPhase = useRef("");
  const record = useCallback((message: string, kind: Entry["kind"] = "info") => {
    setEntries((previous) => [...previous.slice(-79), { time: new Date().toLocaleTimeString([], { hour12: false }), message, kind }]);
  }, []);

  const loadRelease = useCallback(async () => {
    releaseController.current?.abort();
    const controller = new AbortController();
    releaseController.current = controller;
    setLoading(true); setReleaseError(""); setRelease(null); setSuccess(false);
    try {
      const response = await fetch("/api/releases", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The latest release could not be loaded.");
      if (!data.tag || !data.firmware?.url) throw new Error("Release data is incomplete. Check the Cloudflare API deployment.");
      setRelease(data); record(`Latest release loaded: ${data.tag}.`);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = errorMessage(error);
      setReleaseError(message); record(message, "error");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [record]);

  useEffect(() => {
    setSupported(window.isSecureContext && Boolean(serialAPI()));
    void loadRelease();
    const api = serialAPI();
    function disconnect(event: Event) {
      const disconnected = (event as Event & { port?: SerialPort }).port || event.target;
      if (disconnected === portRef.current) {
        portRef.current = null; setPort(null); setSuccess(false);
        record("USB device disconnected. Reconnect it and select the device again.", "error");
        if (!busyRef.current) setUploadError("Your device was disconnected. Reconnect USB and select it again.");
      }
    }
    api?.addEventListener("disconnect", disconnect);
    return () => { releaseController.current?.abort(); api?.removeEventListener("disconnect", disconnect); };
  }, [loadRelease, record]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (busy) window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [busy]);

  async function selectDevice() {
    const api = serialAPI();
    if (!api || busyRef.current) return;
    setSelecting(true); setUploadError(""); setSuccess(false); setReady(false); setPercent(0); setPhase("");
    try {
      const selected = await api.requestPort();
      portRef.current = selected; setPort(selected);
      const info = selected.getInfo();
      record(`USB device selected${info.usbVendorId ? ` (vendor 0x${info.usbVendorId.toString(16)})` : ""}. Chip will be checked before writing.`);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "NotFoundError")) {
        setUploadError(errorMessage(error)); record(errorMessage(error), "error");
      }
    } finally { setSelecting(false); }
  }

  async function flash() {
    if (!port || !release || !ready || busyRef.current) return;
    const selectedPort = port;
    busyRef.current = true; setBusy(true); setSuccess(false); setUploadError(""); setPercent(0);
    lastPhase.current = "";
    setPhase("Downloading firmware"); record(`Downloading ${release.tag} firmware.`);
    try {
      const hex = await downloadFirmware(release.firmware);
      const image = parseHex(hex);
      record(`Firmware integrity checked. ${(image.length / 1024).toFixed(1)} KiB to write and verify.`);
      if (portRef.current !== selectedPort) throw new Error("The USB device disconnected before upload. Reconnect and select it again.");
      await uploadFirmware(selectedPort, hex, (label, value) => {
        setPhase(label); setPercent(value);
        if (lastPhase.current !== label) { record(label); lastPhase.current = label; }
      });
      setSuccess(true); record(`Firmware ${release.tag} installed and verified. Reader restarted.`, "success");
    } catch (error) {
      const message = errorMessage(error);
      setUploadError(message); setPhase("Upload stopped"); record(message, "error");
    } finally { busyRef.current = false; setBusy(false); }
  }

  const currentStep = success ? 3 : port ? 3 : release ? 2 : 1;
  const date = release ? new Date(release.publishedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "";

  return <div className="app-shell">
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="/" aria-label="Jaguar Reader home"><span className="brand-icon"><ClawMark/></span><span>jaguar<span className="brand-light">reader</span></span><span className="brand-divider"/><span className="brand-subtitle">Web programmer</span></a>
      <nav aria-label="Main navigation" className="nav-links">
        <button className={view === "programmer" ? "nav-button active" : "nav-button"} onClick={() => setView("programmer")} disabled={busy}>Programmer</button>
        <button className={view === "guide" ? "nav-button active" : "nav-button"} onClick={() => setView("guide")} disabled={busy}>Setup guide</button>
        <a className="github-link" href={REPOSITORY} target="_blank" rel="noreferrer" aria-label="GitHub repository"><Github size={17}/><span>GitHub</span><ArrowUpRight size={13}/></a>
        <ThemeToggle/>
      </nav>
    </div></header>

    <main className="main-content">
      {view === "guide" ? <SetupGuide/> : <>
        <section className="intro"><div><div className="intro-kicker"><span className="red-line"/>Built for your Atari Jaguar cartridge reader</div><h1>New firmware.<br/>Same great hardware.</h1><p>Keep your reader up to date. Install the latest firmware<br className="desktop-break"/> directly from your browser, in just a few steps.</p></div>
          <div className="browser-note"><div className={`browser-status ${supported === false ? "unsupported" : ""}`}><span className="status-dot"/>{supported === null ? "Checking browser" : supported ? "Your browser is ready" : "Use desktop Chrome or Edge"}</div><span>USB connection · No install needed</span></div>
        </section>

        {supported === false && <div className="notice warning" role="status"><CircleAlert size={19}/><div><strong>USB programming needs Web Serial.</strong> Open this page in desktop Chrome or Edge over HTTPS. You can still download the firmware and game database here.</div></div>}

        <div className="workspace-grid">
          <section className="program-panel" aria-labelledby="program-heading">
            <div className="panel-heading"><div><h2 id="program-heading">Let’s update your reader</h2><p>Three steps. One fresh start.</p></div></div>
            <div className="steps">
              <section className={`step ${currentStep === 1 ? "current" : ""}`} aria-labelledby="firmware-heading">
                <span className={`step-marker ${release ? "complete" : ""}`}>{release ? <Check size={15}/> : "1"}</span>
                <div className="step-content"><div className="step-heading"><h3 id="firmware-heading">Get the latest firmware</h3><button className="icon-button" onClick={() => void loadRelease()} disabled={loading || busy} aria-label="Refresh latest release"><RefreshCw size={15} className={loading ? "spin" : ""}/></button></div><p>Official release from oscrusergroup/firmware-jaguar-standalone.</p>
                  {loading ? <div className="release-box loading-release"><span className="skeleton w-24"/><span className="skeleton w-36"/></div> : releaseError ? <div className="release-error" role="alert"><CircleAlert size={17}/><div>{releaseError}<button onClick={() => void loadRelease()} className="text-link mt-2 block">Try again</button></div></div> : release && <div className="release-box"><div className="release-top"><span className="version">{release.tag}</span><span className="latest-badge">Latest stable</span><a className="release-link" href={release.url} target="_blank" rel="noreferrer" aria-label={`View ${release.tag} release notes`}><ArrowUpRight size={17}/></a></div><div className="release-meta"><span>{date}</span><span className="meta-dot"/><span>{(release.firmware.size / 1024).toFixed(1)} KB download</span></div><div className="firmware-file"><Code2 size={13}/><span>{release.firmware.name}</span></div></div>}
                </div>
              </section>

              <section className={`step ${currentStep === 2 ? "current" : ""}`} aria-labelledby="device-heading">
                <span className={`step-marker ${port ? "complete" : ""}`}>{port ? <Check size={15}/> : "2"}</span><div className="step-content"><h3 id="device-heading">Connect your reader</h3><p>Plug your Mega 2560 into a USB data port.</p>
                  <button className={`connect-button ${port ? "selected" : ""}`} onClick={() => void selectDevice()} disabled={supported !== true || busy || selecting}>{selecting ? <LoaderCircle size={17} className="spin"/> : <Usb size={17}/>}<span>{selecting ? "Opening device picker…" : port ? "USB device selected" : "Select USB device"}</span>{port ? <Check size={16}/> : <ChevronRight size={16}/>}</button>
                  <span className="device-hint">{port ? "Mega 2560 chip checked when upload starts." : "Choose your Arduino’s serial port in the popup."}</span>
                </div>
              </section>

              <section className={`step last-step ${currentStep === 3 ? "current" : ""}`} aria-labelledby="upload-heading"><span className={`step-marker ${success ? "complete" : ""}`}>{success ? <Check size={15}/> : "3"}</span><div className="step-content"><h3 id="upload-heading">Install & verify</h3><p>We’ll write the firmware, then check every byte.</p>
                <label className="readiness-check"><input type="checkbox" checked={ready} onChange={(event) => setReady(event.target.checked)} disabled={busy}/><span>I’ve closed other apps using the serial port.</span></label>
                <div className="program-actions">
                  <button className="flash-button" onClick={() => void flash()} disabled={!release || !port || !ready || busy || selecting || loading}>{busy ? <LoaderCircle size={18} className="spin"/> : success ? <CircleCheck size={18}/> : <PlugZap size={18}/>}<span>{busy ? "Updating your reader…" : success ? "Install again" : "Install firmware"}</span>{!busy && !success && <ChevronRight size={17}/>}</button>
                  <div className="sd-card-download">
                    {release?.database ? <a href={release.database.url} className="database-download"><ArrowDownToLine size={14}/>Download jag.txt</a> : <span className="database-pending">{loading ? "Checking jag.txt…" : release ? "No jag.txt in this release." : "Load a release to download jag.txt."}</span>}
                    <p>Place <code>jag.txt</code> at the root of your SD card.</p>
                  </div>
                </div>
                {!busy && !success && <span className="device-hint text-center">{!port ? "Select a USB device to continue." : !ready ? "Confirm the serial port is free to continue." : "Keep your reader connected until the update is complete."}</span>}
                {(busy || success || uploadError) && <div className="upload-progress" aria-live="polite"><div className="progress-label"><span>{phase}</span><span>{percent}%</span></div><div className={`progress-track ${success ? "success" : ""}`} role="progressbar" aria-label="Firmware installation" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${percent}%` }}/></div>{busy && <p>Keep this tab open and your USB cable connected.</p>}</div>}
              </div></section>
            </div>
            <div className="panel-footnote"><ShieldCheck size={15}/><span>Chip checked before writing. Verified before success.</span></div>
          </section>

          <aside className="hardware-column" aria-label="Target hardware">
            <div className="hardware-card"><div className="hardware-card-top"><span className="hardware-label"><span className="tiny-chip"><Cpu size={14}/></span>Target hardware</span><span className="chip-badge">ATmega2560</span></div>
              <div className="board-stage"><Image src="/jaguar-reader.webp" alt="Blue Jaguar cartridge reader board with cartridge slot and OLED display" width={1448} height={1086} className="reader-photo" loading="eager"/></div>
              <div className={`board-status ${port ? "selected" : ""}`}>{busy ? <LoaderCircle size={14} className="spin"/> : port ? <Usb size={14}/> : <Unplug size={14}/>}<span>{busy ? "USB transfer in progress" : port ? "USB device selected" : "Waiting for your USB device"}</span></div>
              <div className="hardware-details"><div><h2>Jaguar cartridge reader</h2><p>Powered by an Arduino Mega 2560.</p></div><dl><div><dt>Processor</dt><dd>ATmega2560</dd></div><div><dt>Upload speed</dt><dd>115,200 baud</dd></div><div><dt>Connection</dt><dd>USB serial</dd></div></dl></div>
            </div>

          </aside>
        </div>

        {uploadError && <div className="notice error-notice" role="alert"><CircleAlert size={19}/><div><strong>The update couldn’t finish.</strong><p>{uploadError}</p><button className="text-link" onClick={() => setView("guide")} disabled={busy}>Open troubleshooting</button></div><button aria-label="Dismiss upload error" className="icon-button" onClick={() => setUploadError("")}><X size={17}/></button></div>}
        {success && <div className="notice success-notice" role="status"><CircleCheck size={21}/><div><strong>Your reader is up to date.</strong><p>{release?.tag} was installed and verified. You can unplug the reader. Remember to copy jag.txt to your SD card.</p></div></div>}

        <section className="activity"><button className="activity-toggle" onClick={() => setActivityOpen(!activityOpen)} aria-expanded={activityOpen} aria-controls="activity-log"><Terminal size={16}/><span>Activity log</span><span className="activity-count">{entries.length}</span><span className="activity-summary">{busy ? phase : success ? "Update complete" : "Everything happens here, on your device."}</span><ChevronDown size={16} className={activityOpen ? "rotate-180" : ""}/></button>{activityOpen && <div id="activity-log" className="activity-log" role="log" aria-live="polite">{entries.length ? entries.map((entry, index) => <div className={`log-line ${entry.kind}`} key={index}><time>{entry.time}</time><span>{entry.message}</span></div>) : <p>Connect a device to start a programming session.</p>}</div>}</section>

        <div className="help-strip"><span><CircleAlert size={15}/>First time here?</span><p>A USB data cable and a desktop browser are all you need.</p><button className="text-link" onClick={() => setView("guide")} disabled={busy}>Read the setup guide <ArrowUpRight size={14}/></button></div>
      </>}
    </main>
    <footer className="site-footer"><div><span className="footer-mark"><ClawMark/></span><span>Made for the Jaguar preservation community.</span></div><a href={REPOSITORY} target="_blank" rel="noreferrer">Open source firmware <ArrowUpRight size={13}/></a></footer>
  </div>;
}
