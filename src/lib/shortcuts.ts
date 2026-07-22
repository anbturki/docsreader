import { isMac } from "@/lib/platform";

export interface ParsedShortcut {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

export function parseShortcut(str: string): ParsedShortcut | undefined {
  const parts = str
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  let mod = false;
  let shift = false;
  let alt = false;
  let key = "";
  for (const raw of parts) {
    const p = raw.toLowerCase();
    if (p === "mod" || p === "cmd" || p === "ctrl" || p === "control" || p === "meta") mod = true;
    else if (p === "shift") shift = true;
    else if (p === "alt" || p === "option" || p === "opt") alt = true;
    else key = raw.length === 1 ? raw.toLowerCase() : raw;
  }
  if (!key) return undefined;
  return { mod, shift, alt, key };
}

export function matchShortcut(event: KeyboardEvent, shortcut: ParsedShortcut): boolean {
  const eventMod = isMac ? event.metaKey : event.ctrlKey;
  if (shortcut.mod !== eventMod) return false;
  if (shortcut.shift !== event.shiftKey) return false;
  if (shortcut.alt !== event.altKey) return false;
  const evKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return evKey === shortcut.key;
}

export function captureShortcut(event: KeyboardEvent): string | undefined {
  const k = event.key;
  if (k === "Meta" || k === "Control" || k === "Shift" || k === "Alt") return undefined;
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("Mod");
  if (event.shiftKey) parts.push("Shift");
  if (event.altKey) parts.push("Alt");
  parts.push(normalizeKeyName(k));
  return parts.join("+");
}

export function displayShortcut(str: string): string {
  const parsed = parseShortcut(str);
  if (!parsed) return str;
  const parts: string[] = [];
  if (parsed.mod) parts.push(isMac ? "⌘" : "Ctrl");
  if (parsed.shift) parts.push(isMac ? "⇧" : "Shift");
  if (parsed.alt) parts.push(isMac ? "⌥" : "Alt");
  parts.push(prettyKey(parsed.key));
  return isMac ? parts.join("") : parts.join("+");
}

function normalizeKeyName(k: string): string {
  if (k.length === 1) return k.toUpperCase();
  return k;
}

function prettyKey(k: string): string {
  if (k.length === 1) return k.toUpperCase();
  const map: Record<string, string> = {
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    enter: "↵",
    escape: "Esc",
    " ": "Space",
  };
  return map[k.toLowerCase()] ?? k;
}
