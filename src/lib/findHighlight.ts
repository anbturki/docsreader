export interface HighlightPainter {
  paint(ranges: Range[], currentIndex: number): void;
  clear(): void;
  destroy(): void;
}

/**
 * Marks every element the overlay adapter owns. Consumers watching the
 * scroller for React re-renders filter these out, otherwise the painter's own
 * writes would retrigger the recompute that produced them.
 */
export const FIND_OVERLAY_ATTR = "data-find-overlay";

export const HIGHLIGHT_ALL = "docsreader-find-all";
export const HIGHLIGHT_CURRENT = "docsreader-find-current";

/**
 * Painting every rect of a large result set costs more than it helps; beyond
 * this many the remaining matches stay navigable but unpainted.
 */
export const MAX_PAINTED_RANGES = 300;

interface HighlightRegistry {
  set(name: string, highlight: HighlightLike): void;
  delete(name: string): void;
}

interface HighlightLike {
  priority: number;
}

interface HighlightConstructor {
  new (...ranges: Range[]): HighlightLike;
}

interface HighlightCapableCss {
  highlights: HighlightRegistry;
}

function highlightRegistry(): HighlightRegistry | undefined {
  if (typeof CSS === "undefined") return undefined;
  const candidate: unknown = CSS;
  if (typeof candidate !== "object" || candidate === null) return undefined;
  if (!("highlights" in candidate)) return undefined;
  const registry = (candidate as HighlightCapableCss).highlights;
  if (typeof registry?.set !== "function") return undefined;
  return registry;
}

function highlightConstructor(): HighlightConstructor | undefined {
  const scope: Record<string, unknown> = globalThis as Record<string, unknown>;
  const ctor = scope.Highlight;
  return typeof ctor === "function" ? (ctor as HighlightConstructor) : undefined;
}

export function supportsHighlightApi(): boolean {
  return highlightRegistry() !== undefined && highlightConstructor() !== undefined;
}

export function createHighlightPainter(scroller: HTMLElement): HighlightPainter {
  const registry = highlightRegistry();
  const Highlight = highlightConstructor();
  if (registry && Highlight) {
    return createRegistryPainter(registry, Highlight);
  }
  return createOverlayPainter(scroller);
}

function splitCurrent(
  ranges: Range[],
  currentIndex: number
): { current: Range[]; rest: Range[] } {
  const current = ranges[currentIndex];
  if (!current) return { current: [], rest: ranges };
  return { current: [current], rest: ranges.filter((_, i) => i !== currentIndex) };
}

// Zero DOM mutation: the ranges are handed to the engine, which paints them as
// an overlay outside the document tree, so React never sees a change.
function createRegistryPainter(
  registry: HighlightRegistry,
  Highlight: HighlightConstructor
): HighlightPainter {
  const clear = () => {
    registry.delete(HIGHLIGHT_ALL);
    registry.delete(HIGHLIGHT_CURRENT);
  };

  return {
    paint(ranges, currentIndex) {
      clear();
      if (ranges.length === 0) return;
      const { current, rest } = splitCurrent(ranges, currentIndex);
      if (rest.length > 0) {
        registry.set(HIGHLIGHT_ALL, new Highlight(...rest));
      }
      if (current.length > 0) {
        const highlight = new Highlight(...current);
        // Ties break by registration recency, which is too implicit to rely on.
        highlight.priority = 1;
        registry.set(HIGHLIGHT_CURRENT, highlight);
      }
    },
    clear,
    destroy: clear,
  };
}

function createOverlayPainter(scroller: HTMLElement): HighlightPainter {
  const container = scroller.ownerDocument.createElement("div");
  container.setAttribute(FIND_OVERLAY_ATTR, "true");
  container.className = "find-overlay";
  scroller.appendChild(container);

  let painted: Range[] = [];
  let paintedCurrent = -1;
  let frame = 0;

  const draw = () => {
    container.replaceChildren();
    if (painted.length === 0) return;
    // Absolutely positioned children of a scrolling container are placed
    // against its padding box, so they scroll with the content rather than
    // sticking to the viewport.
    const origin = scroller.getBoundingClientRect();
    const { current, rest } = splitCurrent(painted, paintedCurrent);
    for (const range of rest.slice(0, MAX_PAINTED_RANGES)) {
      appendRects(container, scroller, origin, range, false);
    }
    for (const range of current) {
      appendRects(container, scroller, origin, range, true);
    }
  };

  const scheduleDraw = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      draw();
    });
  };

  scroller.addEventListener("scroll", scheduleDraw, { passive: true });
  const resizeObserver = new ResizeObserver(scheduleDraw);
  resizeObserver.observe(scroller);

  return {
    paint(ranges, currentIndex) {
      painted = ranges;
      paintedCurrent = currentIndex;
      draw();
    },
    clear() {
      painted = [];
      paintedCurrent = -1;
      container.replaceChildren();
    },
    destroy() {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", scheduleDraw);
      resizeObserver.disconnect();
      container.remove();
    },
  };
}

function appendRects(
  container: HTMLElement,
  scroller: HTMLElement,
  origin: DOMRect,
  range: Range,
  isCurrent: boolean
): void {
  for (const rect of Array.from(range.getClientRects())) {
    const mark = container.ownerDocument.createElement("div");
    mark.setAttribute(FIND_OVERLAY_ATTR, "true");
    mark.className = isCurrent ? "find-overlay-mark is-current" : "find-overlay-mark";
    mark.style.top = `${rect.top - origin.top + scroller.scrollTop}px`;
    mark.style.left = `${rect.left - origin.left + scroller.scrollLeft}px`;
    mark.style.width = `${rect.width}px`;
    mark.style.height = `${rect.height}px`;
    container.appendChild(mark);
  }
}
