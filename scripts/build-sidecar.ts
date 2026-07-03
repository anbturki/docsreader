// Builds the docsreader-mcp sidecar and places it where the Tauri bundler
// expects external binaries: src-tauri/binaries/docsreader-mcp-<triple>[.exe].
// The triple comes from TAURI_ENV_TARGET_TRIPLE when run as a Tauri hook;
// "universal-apple-darwin" builds both Apple arches and merges them via lipo.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const srcTauri = path.join(root, "src-tauri");
const outDir = path.join(srcTauri, "binaries");

function run(cmd: string, args: string[]): string {
  const res = spawnSync(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "inherit"] });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited with ${res.status}`);
  }
  return res.stdout.toString();
}

function hostTriple(): string {
  const line = run("rustc", ["-vV"])
    .split("\n")
    .find((l) => l.startsWith("host: "));
  if (!line) throw new Error("could not determine host triple from rustc -vV");
  return line.slice("host: ".length).trim();
}

function buildFor(target: string): string {
  run("cargo", [
    "build",
    "--release",
    "--manifest-path",
    path.join(srcTauri, "Cargo.toml"),
    "-p",
    "docsreader-mcp",
    "--target",
    target,
  ]);
  const ext = target.includes("windows") ? ".exe" : "";
  return path.join(srcTauri, "target", target, "release", `docsreader-mcp${ext}`);
}

const triple = process.env.TAURI_ENV_TARGET_TRIPLE ?? hostTriple();
mkdirSync(outDir, { recursive: true });

if (triple === "universal-apple-darwin") {
  const slices = ["aarch64-apple-darwin", "x86_64-apple-darwin"].map(buildFor);
  const dest = path.join(outDir, `docsreader-mcp-${triple}`);
  run("lipo", ["-create", ...slices, "-output", dest]);
  console.log(`sidecar: ${dest} (universal)`);
} else {
  const ext = triple.includes("windows") ? ".exe" : "";
  const dest = path.join(outDir, `docsreader-mcp-${triple}${ext}`);
  copyFileSync(buildFor(triple), dest);
  console.log(`sidecar: ${dest}`);
}
