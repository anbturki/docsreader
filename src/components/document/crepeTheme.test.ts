import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const CREPE_THEME = join(process.cwd(), "node_modules/@milkdown/crepe/lib/theme/common");
const OUR_THEME = join(process.cwd(), "src/components/document/crepe-theme.css");

const CARET_DECLARATION = /(?:caret-color|--prosemirror-virtual-cursor-color)\s*:\s*([^;]+);/;
const RULE = /([^{}]+)\{([^{}]*)\}/g;

// Every selector upstream that paints a caret from --crepe-color-outline, the
// variable this app points at the muted foreground for icons and placeholders.
function upstreamCaretSelectors(): string[] {
  const selectors: string[] = [];
  for (const entry of readdirSync(CREPE_THEME)) {
    if (!entry.endsWith(".css")) continue;
    const css = readFileSync(join(CREPE_THEME, entry), "utf8");
    for (const [, selector, body] of css.matchAll(RULE)) {
      const caret = body.match(CARET_DECLARATION);
      if (caret?.[1].includes("--crepe-color-outline")) selectors.push(selector.trim());
    }
  }
  return selectors;
}

describe("crepe caret", () => {
  it("finds the upstream carets it is overriding, so the check cannot pass vacuously", () => {
    expect(upstreamCaretSelectors().length).toBeGreaterThan(0);
  });

  it("re-points every one of them, leaving the muted outline to icons and placeholders", () => {
    const ours = readFileSync(OUR_THEME, "utf8");
    for (const selector of upstreamCaretSelectors()) {
      expect(ours).toContain(selector);
    }
    expect(ours).toMatch(/--crepe-color-caret:\s*var\(--foreground\)/);
    expect(ours).not.toMatch(/--crepe-color-caret:\s*var\(--muted-foreground\)/);
  });
});
