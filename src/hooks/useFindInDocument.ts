import { useCallback, useEffect, useRef, useState } from "react";

import { findRanges } from "@/lib/findMatches";
import {
  createHighlightPainter,
  FIND_OVERLAY_ATTR,
  type HighlightPainter,
} from "@/lib/findHighlight";

export interface FindInDocument {
  open: boolean;
  query: string;
  matchCount: number;
  /** 0-based position of the focused match, or -1 when there are none. */
  currentIndex: number;
  setQuery: (query: string) => void;
  next: () => void;
  previous: () => void;
  show: () => void;
  hide: () => void;
}

export function useFindInDocument(
  scroller: HTMLElement | null,
  enabled: boolean
): FindInDocument {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);
  // The ranges live in a ref, so nothing about them can drive an effect. This
  // counter is the repaint signal: without it, editing a query that happens to
  // keep the same match count would leave the previous ranges on screen.
  const [revision, setRevision] = useState(0);

  const ranges = useRef<Range[]>([]);
  const painter = useRef<HighlightPainter | undefined>(undefined);

  useEffect(() => {
    if (!scroller) return;
    painter.current = createHighlightPainter(scroller);
    return () => {
      painter.current?.destroy();
      painter.current = undefined;
    };
  }, [scroller]);

  const recompute = useCallback(() => {
    if (!scroller || !open || !query.trim()) {
      ranges.current = [];
      setMatchCount(0);
      setCurrentIndex(-1);
      setRevision((r) => r + 1);
      return;
    }
    ranges.current = findRanges(scroller, query);
    setMatchCount(ranges.current.length);
    setCurrentIndex(ranges.current.length > 0 ? 0 : -1);
    setRevision((r) => r + 1);
  }, [scroller, open, query]);

  useEffect(() => {
    recompute();
  }, [recompute]);

  // Live ranges do not error when React replaces the nodes they point into,
  // they silently collapse. Rebuilding on any document mutation is the only
  // reliable signal, since every render path here can swap the subtree.
  useEffect(() => {
    if (!scroller || !open) return;
    const observer = new MutationObserver((records) => {
      if (records.every(isOwnPaint)) return;
      recompute();
    });
    observer.observe(scroller, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [scroller, open, recompute]);

  useEffect(() => {
    if (!painter.current) return;
    painter.current.paint(ranges.current, currentIndex);
  }, [revision, currentIndex]);

  useEffect(() => {
    if (!scroller) return;
    const range = ranges.current[currentIndex];
    if (range) scrollRangeIntoView(scroller, range);
  }, [scroller, currentIndex]);

  useEffect(() => {
    if (enabled) return;
    setOpen(false);
  }, [enabled]);

  const step = useCallback((delta: number) => {
    setCurrentIndex((index) => {
      const count = ranges.current.length;
      if (count === 0) return -1;
      return (index + delta + count) % count;
    });
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    setQuery("");
    ranges.current = [];
    setMatchCount(0);
    setCurrentIndex(-1);
    painter.current?.clear();
  }, []);

  return {
    open,
    query,
    matchCount,
    currentIndex,
    setQuery,
    next: useCallback(() => step(1), [step]),
    previous: useCallback(() => step(-1), [step]),
    show: useCallback(() => setOpen(true), []),
    hide,
  };
}

function isOwnPaint(record: MutationRecord): boolean {
  return (
    record.target instanceof Element &&
    record.target.closest(`[${FIND_OVERLAY_ATTR}]`) !== null
  );
}

function scrollRangeIntoView(scroller: HTMLElement, range: Range): void {
  const target = range.getBoundingClientRect();
  if (target.width === 0 && target.height === 0) return;
  const view = scroller.getBoundingClientRect();
  const top = target.top - view.top + scroller.scrollTop - view.height / 2;
  scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}
