import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultPaneLayout,
  loadPaneLayout,
  savePaneLayout,
  TABS_KEY_PANE0,
  TABS_KEY_PANE1,
  type PaneLayout,
  type SplitMode,
} from "@/lib/storage";
import { useTabs, type Tabs } from "./useTabs";

export type PaneIndex = 0 | 1;

export interface Panes {
  layout: PaneLayout;
  hydrated: boolean;
  panes: [Tabs, Tabs];
  activePane: Tabs;
  setSplit: (mode: SplitMode) => void;
  setSplitSize: (size: number) => void;
  focusPane: (idx: PaneIndex) => void;
  openInOtherPane: (path: string) => void;
}

interface UsePanesOptions {
  autoReloadOnExternalChange: boolean;
}

export function usePanes(options: UsePanesOptions): Panes {
  const [layout, setLayout] = useState<PaneLayout>(defaultPaneLayout);
  const [layoutHydrated, setLayoutHydrated] = useState(false);

  const pane0 = useTabs({
    autoReloadOnExternalChange: options.autoReloadOnExternalChange,
    storageKey: TABS_KEY_PANE0,
  });
  const pane1 = useTabs({
    autoReloadOnExternalChange: options.autoReloadOnExternalChange,
    storageKey: TABS_KEY_PANE1,
  });

  // Hydrate layout once.
  useEffect(() => {
    let cancelled = false;
    void loadPaneLayout().then((l) => {
      if (cancelled) return;
      setLayout(l);
      setLayoutHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist layout (debounced) once hydrated.
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!layoutHydrated) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      void savePaneLayout(layout);
    }, 200);
  }, [layout, layoutHydrated]);
  useEffect(
    () => () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    },
    []
  );

  const setSplit = useCallback((mode: SplitMode) => {
    setLayout((l) => {
      if (l.split === mode) return l;
      // Collapsing back to single: force focus to pane 0. Pane 1's tabs
      // persist in storage but stop rendering - re-splitting brings them
      // back exactly as they were.
      if (mode === "off") return { ...l, split: "off", activePane: 0 };
      return { ...l, split: mode };
    });
  }, []);

  const setSplitSize = useCallback((size: number) => {
    const clamped = Math.min(85, Math.max(15, size));
    setLayout((l) => (Math.abs(l.splitSize - clamped) < 0.5 ? l : { ...l, splitSize: clamped }));
  }, []);

  const focusPane = useCallback((idx: PaneIndex) => {
    setLayout((l) => {
      if (l.split === "off") return l;
      if (l.activePane === idx) return l;
      return { ...l, activePane: idx };
    });
  }, []);

  // Open a path in the pane that is not currently active. If split is
  // off, auto-enable horizontal split first so the user actually sees
  // two panes. The current pane becomes the "other" once we focus the
  // freshly-targeted one.
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const openInOtherPane = useCallback(
    (path: string) => {
      const current = layoutRef.current;
      const targetPane: PaneIndex =
        current.split === "off" ? 1 : current.activePane === 0 ? 1 : 0;
      if (current.split === "off") {
        setLayout((l) => ({ ...l, split: "horizontal", activePane: targetPane }));
      } else if (current.activePane !== targetPane) {
        setLayout((l) => ({ ...l, activePane: targetPane }));
      }
      if (targetPane === 0) pane0.openInActive(path);
      else pane1.openInActive(path);
    },
    [pane0, pane1]
  );

  const panes: [Tabs, Tabs] = [pane0, pane1];
  const activePane = layout.activePane === 0 ? pane0 : pane1;
  const hydrated = layoutHydrated && pane0.hydrated && pane1.hydrated;

  return {
    layout,
    hydrated,
    panes,
    activePane,
    setSplit,
    setSplitSize,
    focusPane,
    openInOtherPane,
  };
}
