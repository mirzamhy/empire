// Starts bridge + game dev server together. Ctrl+C stops both.
import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const procs = [
  ["bridge", spawn(npm, ["run", "bridge"], { stdio: "inherit", shell: process.platform === "win32" })],
  ["game", spawn(npm, ["run", "game"], { stdio: "inherit", shell: process.platform === "win32" })],
];

console.log("\nEMPIRE dev:");
console.log("  Game  : http://127.0.0.1:5200/");
console.log("  Admin : http://127.0.0.1:8788/admin\n");

const stop = () => {
  for (const [, p] of procs) p.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const [name, p] of procs)
  p.on("exit", (code) => {
    console.log(`[${name}] exited with ${code}`);
    stop();
  });
