import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ENTRY = readFileSync(join(process.cwd(), "src/main.tsx"), "utf8");

describe("the entry point's first paint", () => {
  // It once kept listening, so a reader who had chosen light watched the app
  // turn dark when the system did at sunset, with nothing to correct it: the
  // hook that owns the scheme only reacts to the setting changing.
  it("guesses the scheme once and never follows the system after that", () => {
    expect(ENTRY).toContain("prefers-color-scheme");
    expect(ENTRY).not.toMatch(/addEventListener|addListener|\.onchange/);
  });
});
