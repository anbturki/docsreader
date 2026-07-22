import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  createHighlightPainter,
  supportsHighlightApi,
  FIND_OVERLAY_ATTR,
  HIGHLIGHT_ALL,
  HIGHLIGHT_CURRENT,
  MAX_PAINTED_RANGES,
} from "./findHighlight";

interface FakeHighlight {
  priority: number;
  ranges: Range[];
}

const globals = globalThis as Record<string, unknown>;

function installHighlightApi() {
  const registry = new Map<string, FakeHighlight>();
  globals.Highlight = class {
    priority = 0;
    ranges: Range[];
    constructor(...ranges: Range[]) {
      this.ranges = ranges;
    }
  };
  globals.CSS = { highlights: registry };
  return registry;
}

function removeHighlightApi() {
  delete globals.Highlight;
  globals.CSS = {};
}

function rect(top: number, left: number, width = 10, height = 4): DOMRect {
  return { top, left, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) };
}

function fakeRange(rects: DOMRect[]): Range {
  const range: Partial<Range> = { getClientRects: () => rects as unknown as DOMRectList };
  return range as Range;
}

function makeScroller(): HTMLElement {
  const scroller = document.createElement("div");
  scroller.getBoundingClientRect = () => rect(100, 50, 500, 400);
  Object.defineProperty(scroller, "scrollTop", { value: 20, writable: true });
  Object.defineProperty(scroller, "scrollLeft", { value: 5, writable: true });
  document.body.appendChild(scroller);
  return scroller;
}

function overlayMarks(scroller: HTMLElement): Element[] {
  return [...scroller.querySelectorAll(".find-overlay-mark")];
}

describe("supportsHighlightApi", () => {
  afterEach(() => removeHighlightApi());

  it("is true when the webview exposes the registry and constructor", () => {
    installHighlightApi();
    expect(supportsHighlightApi()).toBe(true);
  });

  it("is false on a webview without the API", () => {
    removeHighlightApi();
    expect(supportsHighlightApi()).toBe(false);
  });
});

describe("registry painter", () => {
  let registry: Map<string, FakeHighlight>;
  let scroller: HTMLElement;

  beforeEach(() => {
    registry = installHighlightApi();
    scroller = makeScroller();
  });

  afterEach(() => {
    removeHighlightApi();
    scroller.remove();
  });

  it("is chosen when the API is available", () => {
    createHighlightPainter(scroller).paint([fakeRange([rect(0, 0)])], 0);
    expect(registry.size).toBeGreaterThan(0);
    expect(overlayMarks(scroller)).toHaveLength(0);
  });

  it("registers the current match above the others", () => {
    const painter = createHighlightPainter(scroller);
    painter.paint([fakeRange([rect(0, 0)]), fakeRange([rect(9, 0)])], 1);

    const all = registry.get(HIGHLIGHT_ALL);
    const current = registry.get(HIGHLIGHT_CURRENT);
    expect(all).toBeDefined();
    expect(current).toBeDefined();
    expect(current!.priority).toBeGreaterThan(all!.priority);
    expect(current!.ranges).toHaveLength(1);
  });

  it("leaves the document untouched", () => {
    const doc = document.createElement("article");
    doc.innerHTML = "<p>hello</p>";
    scroller.appendChild(doc);
    const before = doc.innerHTML;

    createHighlightPainter(scroller).paint([fakeRange([rect(0, 0)])], 0);

    expect(doc.innerHTML).toBe(before);
  });

  it("removes both registrations on destroy", () => {
    const painter = createHighlightPainter(scroller);
    painter.paint([fakeRange([rect(0, 0)]), fakeRange([rect(9, 0)])], 0);
    painter.destroy();

    expect(registry.has(HIGHLIGHT_ALL)).toBe(false);
    expect(registry.has(HIGHLIGHT_CURRENT)).toBe(false);
  });

  it("stays reusable after clear", () => {
    const painter = createHighlightPainter(scroller);
    painter.paint([fakeRange([rect(0, 0)])], 0);
    painter.clear();
    expect(registry.size).toBe(0);

    painter.paint([fakeRange([rect(0, 0)])], 0);
    expect(registry.size).toBeGreaterThan(0);
  });

  it("paints nothing for no matches", () => {
    createHighlightPainter(scroller).paint([], -1);
    expect(registry.size).toBe(0);
  });
});

describe("overlay painter", () => {
  let scroller: HTMLElement;

  beforeEach(() => {
    removeHighlightApi();
    scroller = makeScroller();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    scroller.remove();
  });

  it("is chosen when the API is missing", () => {
    createHighlightPainter(scroller).paint([fakeRange([rect(0, 0)])], 0);
    expect(overlayMarks(scroller)).toHaveLength(1);
  });

  it("paints one element per client rect so wrapped matches are covered", () => {
    createHighlightPainter(scroller).paint([fakeRange([rect(0, 0), rect(20, 0)])], 0);

    expect(overlayMarks(scroller)).toHaveLength(2);
  });

  it("converts viewport rects into scroller content coordinates", () => {
    createHighlightPainter(scroller).paint([fakeRange([rect(140, 80)])], 0);

    const mark = overlayMarks(scroller)[0];
    expect(mark).toBeInstanceOf(HTMLElement);
    const style = (mark as HTMLElement).style;
    // top: 140 - 100 + scrollTop 20, left: 80 - 50 + scrollLeft 5
    expect(style.top).toBe("60px");
    expect(style.left).toBe("35px");
  });

  it("distinguishes the current match", () => {
    createHighlightPainter(scroller).paint(
      [fakeRange([rect(0, 0)]), fakeRange([rect(20, 0)])],
      1
    );

    const current = scroller.querySelectorAll(".find-overlay-mark.is-current");
    expect(current).toHaveLength(1);
  });

  it("caps painted matches but always paints the current one", () => {
    const ranges = Array.from({ length: MAX_PAINTED_RANGES + 50 }, (_, i) =>
      fakeRange([rect(i, 0)])
    );
    const currentIndex = ranges.length - 1;

    createHighlightPainter(scroller).paint(ranges, currentIndex);

    expect(overlayMarks(scroller)).toHaveLength(MAX_PAINTED_RANGES + 1);
    expect(scroller.querySelectorAll(".find-overlay-mark.is-current")).toHaveLength(1);
  });

  it("marks every element it owns so consumers can ignore its writes", () => {
    createHighlightPainter(scroller).paint([fakeRange([rect(0, 0), rect(9, 0)])], 0);

    const container = scroller.querySelector(`[${FIND_OVERLAY_ATTR}]`);
    expect(container).not.toBeNull();
    for (const mark of overlayMarks(scroller)) {
      expect(mark.closest(`[${FIND_OVERLAY_ATTR}]`)).not.toBeNull();
    }
  });

  it("leaves the document untouched", () => {
    const doc = document.createElement("article");
    doc.innerHTML = "<p>hello</p>";
    scroller.appendChild(doc);
    const before = doc.innerHTML;

    createHighlightPainter(scroller).paint([fakeRange([rect(0, 0)])], 0);

    expect(doc.innerHTML).toBe(before);
  });

  it("repaints on scroll", () => {
    const painter = createHighlightPainter(scroller);
    painter.paint([fakeRange([rect(0, 0)])], 0);
    expect(overlayMarks(scroller)).toHaveLength(1);

    scroller.dispatchEvent(new Event("scroll"));

    expect(overlayMarks(scroller)).toHaveLength(1);
    painter.destroy();
  });

  it("removes its container on destroy", () => {
    const painter = createHighlightPainter(scroller);
    painter.paint([fakeRange([rect(0, 0)])], 0);
    painter.destroy();

    expect(scroller.querySelector(`[${FIND_OVERLAY_ATTR}]`)).toBeNull();
  });

  it("stays reusable after clear", () => {
    const painter = createHighlightPainter(scroller);
    painter.paint([fakeRange([rect(0, 0)])], 0);
    painter.clear();
    expect(overlayMarks(scroller)).toHaveLength(0);

    painter.paint([fakeRange([rect(0, 0)])], 0);
    expect(overlayMarks(scroller)).toHaveLength(1);
  });

  it("does not throw when the current index is out of range", () => {
    const painter = createHighlightPainter(scroller);
    expect(() => painter.paint([fakeRange([rect(0, 0)])], 9)).not.toThrow();
    expect(overlayMarks(scroller)).toHaveLength(1);
  });

  it("paints nothing for no matches", () => {
    createHighlightPainter(scroller).paint([], -1);
    expect(overlayMarks(scroller)).toHaveLength(0);
  });
});
