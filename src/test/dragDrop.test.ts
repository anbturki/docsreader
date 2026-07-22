import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

interface TauriConfig {
  app: { windows: Array<{ dragDropEnabled?: boolean }> };
}

const config = JSON.parse(
  readFileSync(join(process.cwd(), "src-tauri", "tauri.conf.json"), "utf8")
) as TauriConfig;

// Tauri's drag-drop handler always reports the drag as handled, so wry's
// overrides of draggingEntered / draggingUpdated / performDragOperation on the
// webview never fall through to WebKit. Measured in a WKWebView harness: with
// those overrides in place a card's dragstart and dragend still fire but
// dragover and drop never reach the page, which is what stopped a task card
// from ever landing in another status column.
describe("the webview lets the page run its own drag and drop", () => {
  it("turns off the native drag-drop interception on every window", () => {
    expect(config.app.windows.length).toBeGreaterThan(0);
    for (const window of config.app.windows) {
      expect(window.dragDropEnabled).toBe(false);
    }
  });
});
