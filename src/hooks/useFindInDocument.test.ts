import { act, renderHook } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { useFindInDocument } from "./useFindInDocument";
import { createHighlightPainter } from "@/lib/findHighlight";

vi.mock("@/lib/findHighlight", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/findHighlight")>("@/lib/findHighlight");
  return { ...actual, createHighlightPainter: vi.fn() };
});

const painted: string[][] = [];
const painter = {
  paint: vi.fn((ranges: Range[]) => {
    painted.push(ranges.map((r) => r.toString()));
  }),
  clear: vi.fn(),
  destroy: vi.fn(),
};

function makeScroller(html: string): HTMLElement {
  const scroller = document.createElement("div");
  scroller.innerHTML = html;
  scroller.getBoundingClientRect = () =>
    ({ top: 0, left: 0, width: 400, height: 300 }) as DOMRect;
  scroller.scrollTo = vi.fn();
  document.body.appendChild(scroller);
  return scroller;
}

// jsdom has no layout, so every range measures zero. Give ranges a size where
// the assertion depends on it.
function stubRangeRects() {
  Range.prototype.getBoundingClientRect = () =>
    ({ top: 500, left: 0, width: 20, height: 10 }) as DOMRect;
  Range.prototype.getClientRects = () =>
    [{ top: 500, left: 0, width: 20, height: 10 }] as unknown as DOMRectList;
}

describe("useFindInDocument", () => {
  let scroller: HTMLElement;

  beforeEach(() => {
    stubRangeRects();
    painted.length = 0;
    painter.paint.mockClear();
    vi.mocked(createHighlightPainter).mockReturnValue(painter);
    scroller = makeScroller("<p>alpha needle beta</p><p>another needle here</p>");
  });

  afterEach(() => {
    scroller.remove();
    vi.restoreAllMocks();
  });

  it("starts closed and finds nothing", () => {
    const { result } = renderHook(() => useFindInDocument(scroller, true));

    expect(result.current.open).toBe(false);
    expect(result.current.matchCount).toBe(0);
    expect(result.current.currentIndex).toBe(-1);
  });

  it("counts matches once opened and queried", () => {
    const { result } = renderHook(() => useFindInDocument(scroller, true));

    act(() => result.current.show());
    act(() => result.current.setQuery("needle"));

    expect(result.current.matchCount).toBe(2);
    expect(result.current.currentIndex).toBe(0);
  });

  it("reports no matches for a query that is absent", () => {
    const { result } = renderHook(() => useFindInDocument(scroller, true));

    act(() => result.current.show());
    act(() => result.current.setQuery("absent"));

    expect(result.current.matchCount).toBe(0);
    expect(result.current.currentIndex).toBe(-1);
  });

  it("wraps forward past the last match", () => {
    const { result } = renderHook(() => useFindInDocument(scroller, true));
    act(() => result.current.show());
    act(() => result.current.setQuery("needle"));

    act(() => result.current.next());
    expect(result.current.currentIndex).toBe(1);

    act(() => result.current.next());
    expect(result.current.currentIndex).toBe(0);
  });

  it("wraps backward past the first match", () => {
    const { result } = renderHook(() => useFindInDocument(scroller, true));
    act(() => result.current.show());
    act(() => result.current.setQuery("needle"));

    act(() => result.current.previous());

    expect(result.current.currentIndex).toBe(1);
  });

  it("does not step when there is nothing to step through", () => {
    const { result } = renderHook(() => useFindInDocument(scroller, true));
    act(() => result.current.show());
    act(() => result.current.setQuery("absent"));

    act(() => result.current.next());

    expect(result.current.currentIndex).toBe(-1);
  });

  it("scrolls the focused match into view", () => {
    const { result } = renderHook(() => useFindInDocument(scroller, true));

    act(() => result.current.show());
    act(() => result.current.setQuery("needle"));

    expect(scroller.scrollTo).toHaveBeenCalled();
  });

  it("clears the query and matches when hidden", () => {
    const { result } = renderHook(() => useFindInDocument(scroller, true));
    act(() => result.current.show());
    act(() => result.current.setQuery("needle"));

    act(() => result.current.hide());

    expect(result.current.open).toBe(false);
    expect(result.current.query).toBe("");
    expect(result.current.matchCount).toBe(0);
  });

  it("leaves the document untouched while painting", () => {
    const before = scroller.querySelector("p")?.outerHTML;
    const { result } = renderHook(() => useFindInDocument(scroller, true));

    act(() => result.current.show());
    act(() => result.current.setQuery("needle"));

    expect(scroller.querySelector("p")?.outerHTML).toBe(before);
  });

  it("closes when the pane loses focus", () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useFindInDocument(scroller, enabled),
      { initialProps: { enabled: true } }
    );
    act(() => result.current.show());
    expect(result.current.open).toBe(true);

    rerender({ enabled: false });

    expect(result.current.open).toBe(false);
  });

  it("finds nothing without a scroller", () => {
    const { result } = renderHook(() => useFindInDocument(null, true));

    act(() => result.current.show());
    act(() => result.current.setQuery("needle"));

    expect(result.current.matchCount).toBe(0);
  });

  it("repaints a lengthened query even when the match count is unchanged", () => {
    const { result } = renderHook(() => useFindInDocument(scroller, true));
    act(() => result.current.show());

    act(() => result.current.setQuery("need"));
    act(() => result.current.setQuery("needle"));

    // Both queries match the same two places, so a repaint keyed on the count
    // alone would leave the shorter ranges on screen.
    expect(painted[painted.length - 1]).toEqual(["needle", "needle"]);
  });

  it("repaints when the query narrows to the same count", () => {
    const { result } = renderHook(() => useFindInDocument(scroller, true));
    act(() => result.current.show());

    act(() => result.current.setQuery("needle"));
    act(() => result.current.setQuery("needl"));

    expect(painted[painted.length - 1]).toEqual(["needl", "needl"]);
  });

  it("recounts when the document content changes", async () => {
    const { result } = renderHook(() => useFindInDocument(scroller, true));
    act(() => result.current.show());
    act(() => result.current.setQuery("needle"));
    expect(result.current.matchCount).toBe(2);

    await act(async () => {
      const extra = document.createElement("p");
      extra.textContent = "a third needle";
      scroller.appendChild(extra);
      await Promise.resolve();
    });

    expect(result.current.matchCount).toBe(3);
  });
});
