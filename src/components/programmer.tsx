"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDownToLine, ArrowUpRight, Check, ChevronDown, ChevronRight, CircleAlert, CircleCheck, Code2, Cpu, Github, LoaderCircle, PlugZap, RefreshCw, ShieldCheck, Terminal, Unplug, Usb, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { SetupGuide } from "./setup-guide";
import { heading1, inlineCode, textLink } from "./styles";
import { downloadFirmware, REPOSITORY, type FirmwareRelease } from "@/lib/release";
import { parseHex } from "@/lib/serial/hex";
import { serialAPI, uploadFirmware, type SerialPort } from "@/lib/serial/web-serial";

type Entry = { time: string; message: string; kind: "info" | "error" | "success" };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const container = "mx-auto max-w-300 px-4 xs:px-5 sm:px-6 md:px-9.5 xl:max-w-310";
const notice = "flex items-start gap-3 rounded-lg border p-4 text-xs leading-loose sm:px-5 sm:text-sm";
const iconButton = "inline-flex size-7 items-center justify-center rounded-md text-muted enabled:hover:bg-hover enabled:hover:text-ink";
const stepContent = "min-w-0 flex-1 pt-1";
const stepTitle = "text-base font-bold";
const stepText = "mt-1.5 mb-3 text-sm leading-relaxed text-muted";
const hint = "mt-2 block text-2xs leading-relaxed text-muted";
const logTone: Record<Entry["kind"], string> = { info: "", error: "text-log-error", success: "text-log-success" };
const hardwareSpecs = [["Processor", "ATmega2560"], ["Upload speed", "115,200 baud"], ["Connection", "USB serial"]] as const;

const navButton = (active: boolean) => `relative h-full text-xs font-semibold hover:text-accent sm:text-sm ${active ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.75 after:rounded-t-xs after:bg-accent" : "text-muted"}`;
const stepRow = (last: boolean) => `relative flex gap-3 xs:gap-4 sm:gap-3 md:gap-4 ${last ? "" : "pb-7 before:absolute before:top-8.5 before:bottom-1.5 before:left-3.25 before:w-px before:bg-line"}`;
// The current step's highlight wins over the completed state, as on the final step after success.
const stepMarker = (current: boolean, complete: boolean) => `relative z-10 grid size-7 shrink-0 place-items-center rounded-full border text-sm font-semibold ${current ? "border-danger-line bg-danger-bg text-accent" : complete ? "border-success-line bg-success-bg text-green" : "border-line bg-surface text-muted"}`;
const connectIcon = (selected: unknown) => selected ? "text-green" : "text-muted";

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


  return <div className="min-h-screen">
    <header className="border-b border-line bg-panel"><div className={`${container} flex flex-wrap items-center justify-between gap-1 pt-3.5 2xs:h-18 2xs:flex-nowrap 2xs:gap-5 2xs:pt-0 sm:h-21`}>
      <a className="flex flex-col gap-0.5 text-ink" href="/" aria-label="OSCR Programmer home"><span className="text-2xs leading-tight font-semibold text-muted xs:text-xs sm:text-sm">Standalone Jaguar</span><span className="text-base leading-tight font-extrabold tracking-tight whitespace-nowrap xs:text-lg sm:text-2xl">OSCR Programmer</span><span className="text-3xs font-medium text-muted sm:text-xs">Open Source Cartridge Reader</span></a>
      <nav aria-label="Main navigation" className="flex h-12 w-full items-center gap-2 2xs:h-full 2xs:w-auto xs:gap-3 sm:gap-7">
        <button className={navButton(view === "programmer")} onClick={() => setView("programmer")} disabled={busy}>Programmer</button>
        <button className={navButton(view === "guide")} onClick={() => setView("guide")} disabled={busy}>Setup guide</button>
        <a className="ml-auto flex items-center gap-2 text-sm text-muted hover:text-accent 2xs:ml-0 sm:border-l sm:border-line sm:pl-6" href={REPOSITORY} target="_blank" rel="noreferrer" aria-label="GitHub repository"><Github size={17}/><span className="hidden sm:inline">GitHub</span><ArrowUpRight size={13} className="hidden sm:block"/></a>
        <ThemeToggle/>
      </nav>
    </div></header>

    <main className={container}>
      {view === "guide" ? <SetupGuide/> : <>
        <section className="pt-9 pb-7 sm:flex sm:items-end sm:justify-between sm:gap-6 sm:pt-14 sm:pb-9 xl:pt-16 xl:pb-11"><div><h1 className={heading1}>Program your OSCR</h1></div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-lg border border-success-line bg-success-bg px-3.5 py-3 text-2xs text-muted sm:mt-0 sm:mb-1 sm:block sm:p-3 sm:text-xs md:px-4 md:py-3.5"><div className={`flex items-center gap-2 text-xs font-bold sm:mb-1.5 sm:text-sm ${supported === false ? "text-warning-text" : "text-green"}`}><span className={`size-1.5 rounded-full ${supported === false ? "bg-status-warn" : "bg-status-ok"}`}/>{supported === null ? "Checking browser" : supported ? "Your browser is ready" : "Use desktop Chrome or Edge"}</div><span>USB connection · No install needed</span></div>
        </section>

        {supported === false && <div className={`${notice} mb-5.5 border-warning-line bg-warning-bg text-warning-text`} role="status"><CircleAlert size={19} className="mt-0.5 shrink-0"/><div><strong>USB programming needs Web Serial.</strong> Open this page in desktop Chrome or Edge over HTTPS. You can still download the firmware and game database here.</div></div>}

        <div className="grid items-start gap-5 sm:grid-cols-[1.05fr_1fr] sm:gap-4.5 md:gap-6.5">
          <section className="overflow-hidden rounded-xl border border-line bg-panel" aria-labelledby="program-heading">
            <div className="flex items-center justify-between border-b border-line p-5.5 sm:px-5 sm:pt-6.5 sm:pb-6 md:px-7"><div><h2 id="program-heading" className="text-xl font-bold tracking-tight">Let’s update your reader</h2><p className="mt-1 text-sm text-muted">Three steps. One fresh start.</p></div></div>
            <div className="px-4 py-6 xs:px-6 sm:px-5 md:px-7">
              <section className={stepRow(false)} aria-labelledby="firmware-heading">
                <span className={stepMarker(currentStep === 1, Boolean(release))}>{release ? <Check size={15}/> : "1"}</span>
                <div className={stepContent}><div className="-mt-1 flex items-center justify-between"><h3 id="firmware-heading" className={stepTitle}>Get the latest firmware</h3><button className={iconButton} onClick={() => void loadRelease()} disabled={loading || busy} aria-label="Refresh latest release"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/></button></div><p className={stepText}>Official release from oscrusergroup/firmware-jaguar-standalone.</p>
                  {loading ? <div className="flex h-27 flex-col gap-4 rounded-lg border border-line bg-surface px-4 pt-5"><span className="block h-3 w-24 animate-breathe rounded-sm bg-line"/><span className="block h-3 w-36 animate-breathe rounded-sm bg-line"/></div> : releaseError ? <div className="flex items-start gap-2 rounded-lg bg-danger-bg p-3 text-sm leading-relaxed text-danger-text" role="alert"><CircleAlert size={17} className="mt-0.5"/><div>{releaseError}<button onClick={() => void loadRelease()} className={`${textLink} mt-2 block text-xs`}>Try again</button></div></div> : release && <div className="rounded-lg border border-line bg-surface px-4 pt-3"><div className="flex items-center gap-2.5"><span className="text-xl font-bold tracking-tight">{release.tag}</span><span className="rounded-sm bg-success-bg px-2 py-0.5 text-3xs font-bold text-green">Latest stable</span><a className="ml-auto text-muted" href={release.url} target="_blank" rel="noreferrer" aria-label={`View ${release.tag} release notes`}><ArrowUpRight size={17}/></a></div><div className="mt-1.5 flex items-center gap-2 text-2xs text-muted"><span>{date}</span><span className="size-0.5 rounded-full bg-meta-dot"/><span>{(release.firmware.size / 1024).toFixed(1)} KB download</span></div><div className="mt-3 flex items-center gap-1.5 border-t border-line py-2 text-3xs text-muted"><Code2 size={13} className="shrink-0"/><span className="break-all">{release.firmware.name}</span></div></div>}
                </div>
              </section>

              <section className={stepRow(false)} aria-labelledby="device-heading">
                <span className={stepMarker(currentStep === 2, Boolean(port))}>{port ? <Check size={15}/> : "2"}</span><div className={stepContent}><h3 id="device-heading" className={stepTitle}>Connect your reader</h3><p className={stepText}>Plug your Mega 2560 into a USB data port.</p>
                  <button className={`flex h-11 w-full items-center justify-center gap-2 rounded-md border px-3.5 text-sm font-semibold enabled:hover:border-subtle enabled:hover:bg-hover disabled:opacity-55 ${port ? "border-success-line bg-success-bg text-green" : "border-line bg-panel text-ink"}`} onClick={() => void selectDevice()} disabled={supported !== true || busy || selecting}>{selecting ? <LoaderCircle size={17} className={`mr-auto animate-spin ${connectIcon(port)}`}/> : <Usb size={17} className={`mr-auto ${connectIcon(port)}`}/>}<span>{selecting ? "Opening device picker…" : port ? "USB device selected" : "Select USB device"}</span>{port ? <Check size={16} className={`ml-auto ${connectIcon(port)}`}/> : <ChevronRight size={16} className={`ml-auto ${connectIcon(port)}`}/>}</button>
                  <span className={hint}>{port ? "Mega 2560 chip checked when upload starts." : "Choose your Arduino’s serial port in the popup."}</span>
                </div>
              </section>

              <section className={stepRow(true)} aria-labelledby="upload-heading"><span className={stepMarker(currentStep === 3, success)}>{success ? <Check size={15}/> : "3"}</span><div className={stepContent}><h3 id="upload-heading" className={stepTitle}>Install & verify</h3><p className={stepText}>We’ll write the firmware, then check every byte.</p>
                <label className="my-3 flex cursor-pointer items-center gap-2 text-3xs leading-normal text-muted xs:text-2xs"><input type="checkbox" className="size-3.5 shrink-0 accent-accent" checked={ready} onChange={(event) => setReady(event.target.checked)} disabled={busy}/><span>I’ve closed other apps using the serial port.</span></label>
                <div className="flex flex-col gap-3.5">
                  <button className={`flex h-11 w-full items-center justify-center gap-2 rounded-md border border-button bg-button px-4 text-sm font-bold text-white enabled:hover:border-button-hover enabled:hover:bg-button-hover ${busy ? "" : "disabled:border-disabled-bg disabled:bg-disabled-bg disabled:text-disabled-text"}`} onClick={() => void flash()} disabled={!release || !port || !ready || busy || selecting || loading}>{busy ? <LoaderCircle size={18} className="mr-auto animate-spin"/> : success ? <CircleCheck size={18} className="mr-auto"/> : <PlugZap size={18} className="mr-auto"/>}<span>{busy ? "Updating your reader…" : success ? "Install again" : "Install firmware"}</span>{!busy && !success && <ChevronRight size={17} className="ml-auto"/>}</button>
                  <div className="w-full text-center">
                    {release?.database ? <a href={release.database.url} className="flex items-center justify-center gap-2 text-xs font-bold text-link hover:text-accent"><ArrowDownToLine size={14}/>Download jag.txt</a> : <span className="text-2xs text-muted">{loading ? "Checking jag.txt…" : release ? "No jag.txt in this release." : "Load a release to download jag.txt."}</span>}
                    <p className="mt-1.5 text-2xs leading-relaxed text-muted">Place <code className={inlineCode}>jag.txt</code> at the root of your SD card.</p>
                  </div>
                </div>
                {!busy && !success && <span className={`${hint} text-center`}>{!port ? "Select a USB device to continue." : !ready ? "Confirm the serial port is free to continue." : "Keep your reader connected until the update is complete."}</span>}
                {(busy || success || uploadError) && <div className="mt-4" aria-live="polite"><div className="mb-2 flex justify-between gap-2.5 text-2xs text-muted"><span>{phase}</span><span>{percent}%</span></div><div className="h-1.5 overflow-hidden rounded-sm bg-line" role="progressbar" aria-label="Firmware installation" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div className={`h-full transition-[width] duration-150 ${success ? "bg-green" : "bg-accent"}`} style={{ width: `${percent}%` }}/></div>{busy && <p className="mt-2 text-2xs leading-relaxed text-muted">Keep this tab open and your USB cable connected.</p>}</div>}
              </div></section>
            </div>
            <div className="flex items-center justify-center gap-2 border-t border-line bg-panel p-4 text-2xs text-muted"><ShieldCheck size={15}/><span>Chip checked before writing. Verified before success.</span></div>
          </section>

          <aside aria-label="Target hardware">
            <div className="overflow-hidden rounded-xl border border-line bg-panel"><div className="flex items-center justify-between px-6 py-4.5"><span className="flex items-center gap-2 text-xs font-semibold text-muted"><Cpu size={14}/>Target hardware</span><span className="rounded-sm bg-surface px-2 py-1 text-3xs text-muted">ATmega2560</span></div>
              <div className="bg-panel"><Image src="/jaguar-reader.webp" alt="Blue Jaguar cartridge reader board with cartridge slot and OLED display" width={1448} height={1086} className="block h-auto w-full" loading="eager"/></div>
              <div className={`flex items-center justify-center gap-2 border-b border-line bg-surface px-5 py-3 text-xs ${port ? "text-green" : "text-muted"}`}>{busy ? <LoaderCircle size={14} className="animate-spin"/> : port ? <Usb size={14}/> : <Unplug size={14}/>}<span>{busy ? "USB transfer in progress" : port ? "USB device selected" : "Waiting for your USB device"}</span></div>
              <div className="px-5 py-6 md:px-6"><div><h2 className="text-xl font-bold tracking-tight">Jaguar cartridge reader</h2><p className="mt-1 mb-5 text-xs text-muted">Powered by an Arduino Mega 2560.</p></div><dl className="flex justify-between gap-4 border-t border-line pt-3.5 sm:gap-3">{hardwareSpecs.map(([term, detail]) => <div key={term}><dt className="mb-1 text-3xs text-muted">{term}</dt><dd className="text-xs font-semibold text-link">{detail}</dd></div>)}</dl></div>
            </div>
          </aside>
        </div>

        {uploadError && <div className={`${notice} mt-5.5 border-danger-line bg-danger-bg text-danger-text`} role="alert"><CircleAlert size={19} className="mt-0.5"/><div><strong>The update couldn’t finish.</strong><p className="mt-0.5 mb-1.5">{uploadError}</p><button className={`${textLink} text-xs`} onClick={() => setView("guide")} disabled={busy}>Open troubleshooting</button></div><button aria-label="Dismiss upload error" className={`${iconButton} ml-auto shrink-0`} onClick={() => setUploadError("")}><X size={17}/></button></div>}
        {success && <div className={`${notice} mt-5.5 border-success-line bg-success-bg text-green`} role="status"><CircleCheck size={21} className="mt-0.5 shrink-0"/><div><strong>Your reader is up to date.</strong><p className="mt-0.5 mb-1.5">{release?.tag} was installed and verified. You can unplug the reader. Remember to copy jag.txt to your SD card.</p></div></div>}

        <section className="mt-6 overflow-hidden rounded-lg border border-line bg-panel"><button className="flex w-full items-center gap-2.5 px-5 py-4 text-left text-xs text-muted" onClick={() => setActivityOpen(!activityOpen)} aria-expanded={activityOpen} aria-controls="activity-log"><Terminal size={16}/><span className="font-semibold">Activity log</span><span className="rounded-sm bg-surface px-1.5 py-px text-3xs text-muted">{entries.length}</span><span className="ml-auto hidden text-2xs text-muted sm:inline">{busy ? phase : success ? "Update complete" : "Everything happens here, on your device."}</span><ChevronDown size={16} className={`ml-auto transition-transform duration-200 sm:ml-1.5 ${activityOpen ? "rotate-180" : ""}`}/></button>{activityOpen && <div id="activity-log" className="max-h-60 overflow-auto bg-log-bg px-5 py-4.5 font-mono text-xs text-log-text" role="log" aria-live="polite">{entries.length ? entries.map((entry, index) => <div className={`flex gap-3.5 py-1 leading-relaxed ${logTone[entry.kind]}`} key={index}><time className="shrink-0 text-muted">{entry.time}</time><span>{entry.message}</span></div>) : <p>Connect a device to start a programming session.</p>}</div>}</section>

        <div className="mt-5.5 mb-7 flex flex-wrap items-center justify-center gap-2 text-2xs leading-loose text-muted sm:mt-6.5 sm:mb-9 sm:gap-3 sm:leading-normal md:flex-nowrap"><span className="flex items-center gap-1.5 font-semibold"><CircleAlert size={15}/>First time here?</span><p className="text-center">A USB data cable and a desktop browser are all you need.</p><button className={`${textLink} flex items-center gap-1 text-2xs`} onClick={() => setView("guide")} disabled={busy}>Read the setup guide <ArrowUpRight size={14}/></button></div>
      </>}
    </main>
    <footer className="mx-5 flex flex-col items-center justify-between gap-4 border-t border-line pt-5 pb-6 text-2xs text-muted sm:mx-6 sm:flex-row sm:pb-7 md:mx-auto md:max-w-281 xl:max-w-291"><a className="flex items-center gap-1 text-muted" href="https://github.com/oscrusergroup" target="_blank" rel="noreferrer">Open Source Cartridge Reader User Group</a></footer>
  </div>;
}
