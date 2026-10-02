import { spawn } from "node:child_process";

// Run the Next UI and its same-origin API together; terminate both on exit.
const children = ["dev:api", "dev:web"].map((script) =>
  spawn("npm", ["run", script], { stdio: "inherit", detached: process.platform !== "win32" }),
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.pid) {
      try {
        if (process.platform === "win32") child.kill("SIGTERM");
        else process.kill(-child.pid, "SIGTERM");
      } catch { /* Child may have already exited. */ }
    }
  }
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => { if (!stopping) stop(code ?? 1); });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
