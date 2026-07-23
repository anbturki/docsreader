import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect } from "vitest";

const SRC = join(process.cwd(), "src");

// Colour sets that are deliberately fixed and do not belong to the theme:
// the shadcn-owned primitives, the code-theme preview swatches (which must
// show each theme's real colours), the token definitions themselves, and the
// syntax-highlighting stylesheet.
const EXEMPT = [
  "components/ui/",
  "components/settings/AppearanceSection.tsx",
  "index.css",
  "styles/code-theme.css",
];

const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/;
const TAILWIND_PALETTE_SHADE =
  /\b(?:text|bg|border|ring|fill|stroke|from|to|via|decoration|shadow|outline|divide|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

function collect(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collect(full, out);
      continue;
    }
    if (!/\.(tsx?|css)$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
    const rel = relative(SRC, full);
    if (EXEMPT.some((prefix) => rel.startsWith(prefix))) continue;
    out.push(full);
  }
  return out;
}

function offenders(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of collect(SRC)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${relative(SRC, file)}:${i + 1}: ${line.trim()}`);
    });
  }
  return hits;
}

describe("theme tokens", () => {
  it("has no colour literals outside the deliberate exceptions", () => {
    expect(offenders(HEX_LITERAL)).toEqual([]);
  });

  it("has no numeric-shade Tailwind palette classes", () => {
    expect(offenders(TAILWIND_PALETTE_SHADE)).toEqual([]);
  });
});
