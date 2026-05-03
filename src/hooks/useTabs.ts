import { useCallback, useEffect, useRef, useState } from "react";
import { readTextFile, watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { parseFrontmatter } from "@/lib/scan";
import { describeEventKind } from "@/lib/events";
import { basename } from "@/lib/path";
import { loadTabsState, saveTabsState } from "@/lib/storage";

export interface Tab {
  id: string;
  path: string;
  title: string;
  content: string;
  meta: Record<string, unknown>;
  error: string | undefined;
  loading: boolean;
}

export interface Tabs {
  tabs: Tab[];
  activeTab: Tab | undefined;
  activeId: string | undefined;
  hydrated: boolean;
  openInActive: (path: string) => void;
  openInNew: (path: string) => void;
  activate: (id: string) => void;
  close: (id: string) => void;
  getScrollTop: (path: string) => number;
  setScrollTop: (path: string, value: number) => void;
}

let tabIdSeq = 0;
const nextId = () => `t${++tabIdSeq}_${Date.now()}`;

function emptyTab(path: string): Tab {
  return {
    id: nextId(),
    path,
    title: basename(path),
    content: "",
    meta: {},
    error: undefined,
    loading: true,
  };
}

export function useTabs(): Tabs {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [hydrated, setHydrated] = useState(false);
  const tabsRef = useRef<Tab[]>([]);
  tabsRef.current = tabs;
  const scrollByPathRef = useRef<Record<string, number>>({});

  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const loadTab = useCallback(
    async (id: string, path: string) => {
      try {
        const raw = await readTextFile(path);
        const { data, content } = parseFrontmatter(raw);
        const current = tabsRef.current.find((t) => t.id === id);
        if (!current || current.path !== path) return;
        updateTab(id, { meta: data, content, error: undefined, loading: false });
      } catch (err) {
        const current = tabsRef.current.find((t) => t.id === id);
        if (!current || current.path !== path) return;
        updateTab(id, {
          error: err instanceof Error ? err.message : String(err),
          content: "",
          meta: {},
          loading: false,
        });
      }
    },
    [updateTab]
  );

  const openInNew = useCallback(
    (path: string) => {
      const tab = emptyTab(path);
      setTabs((prev) => [...prev, tab]);
      setActiveId(tab.id);
      void loadTab(tab.id, path);
    },
    [loadTab]
  );

  const openInActive = useCallback(
    (path: string) => {
      const existing = tabsRef.current.find((t) => t.path === path);
      if (existing) {
        setActiveId(existing.id);
        return;
      }
      const active = tabsRef.current.find((t) => t.id === activeId);
      if (!active) {
        openInNew(path);
        return;
      }
      const newTitle = basename(path);
      updateTab(active.id, {
        path,
        title: newTitle,
        content: "",
        meta: {},
        error: undefined,
        loading: true,
      });
      void loadTab(active.id, path);
    },
    [activeId, openInNew, updateTab, loadTab]
  );

  const activate = useCallback((id: string) => setActiveId(id), []);

  const close = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx < 0) return prev;
        const next = prev.filter((t) => t.id !== id);
        if (activeId === id) {
          const fallback = next[idx] ?? next[idx - 1];
          setActiveId(fallback?.id);
        }
        return next;
      });
    },
    [activeId]
  );

  const watchersRef = useRef(new Map<string, { path: string; unwatch: UnwatchFn }>());

  useEffect(() => {
    const watchers = watchersRef.current;
    const wantedIds = new Set(tabs.map((t) => t.id));

    for (const [id, entry] of watchers) {
      const tab = tabs.find((t) => t.id === id);
      if (!tab || tab.path !== entry.path) {
        void entry.unwatch();
        watchers.delete(id);
      }
    }

    for (const tab of tabs) {
      if (watchers.has(tab.id)) continue;
      const slot: { path: string; unwatch: UnwatchFn } = { path: tab.path, unwatch: () => {} };
      watchers.set(tab.id, slot);
      void (async () => {
        try {
          const unwatch = await watch(
            tab.path,
            (event) => {
              const kind = describeEventKind(event.type);
              if (kind === "remove" || kind === "access") return;
              const current = tabsRef.current.find((t) => t.id === tab.id);
              if (current && current.path === tab.path) void loadTab(tab.id, tab.path);
            },
            { recursive: false, delayMs: 400 }
          );
          if (!wantedIds.has(tab.id) || !watchers.has(tab.id)) {
            void unwatch();
            return;
          }
          slot.unwatch = unwatch;
        } catch (err) {
          watchers.delete(tab.id);
          console.error("watch failed", err);
        }
      })();
    }
  }, [tabs, loadTab]);

  useEffect(() => {
    const watchers = watchersRef.current;
    return () => {
      watchers.forEach((entry) => void entry.unwatch());
      watchers.clear();
    };
  }, []);

  const hydratedRef = useRef(false);
  hydratedRef.current = hydrated;
  const activeIdRef = useRef<string | undefined>(undefined);
  activeIdRef.current = activeId;
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const schedulePersist = useCallback((delay: number) => {
    if (!hydratedRef.current) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const currentTabs = tabsRef.current;
      const active = currentTabs.find((t) => t.id === activeIdRef.current);
      const openPaths = new Set(currentTabs.map((t) => t.path));
      const trimmedScroll: Record<string, number> = {};
      for (const [path, value] of Object.entries(scrollByPathRef.current)) {
        if (openPaths.has(path)) trimmedScroll[path] = value;
      }
      scrollByPathRef.current = trimmedScroll;
      void saveTabsState({
        paths: currentTabs.map((t) => t.path),
        activePath: active?.path,
        scrollByPath: trimmedScroll,
      });
    }, delay);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadTabsState().then((state) => {
      if (cancelled) return;
      scrollByPathRef.current = { ...state.scrollByPath };
      if (state.paths.length > 0) {
        const restored = state.paths.map(emptyTab);
        setTabs(restored);
        const activeIdx = state.activePath ? state.paths.indexOf(state.activePath) : 0;
        const safeIdx = activeIdx >= 0 ? activeIdx : 0;
        setActiveId(restored[safeIdx]?.id);
        restored.forEach((tab, i) => void loadTab(tab.id, state.paths[i]));
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [loadTab]);

  useEffect(() => {
    if (!hydrated) return;
    schedulePersist(250);
  }, [tabs, activeId, hydrated, schedulePersist]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, []);

  const getScrollTop = useCallback((path: string) => scrollByPathRef.current[path] ?? 0, []);

  const setScrollTop = useCallback(
    (path: string, value: number) => {
      scrollByPathRef.current[path] = value;
      schedulePersist(500);
    },
    [schedulePersist]
  );

  const activeTab = tabs.find((t) => t.id === activeId);

  return {
    tabs,
    activeTab,
    activeId,
    hydrated,
    openInActive,
    openInNew,
    activate,
    close,
    getScrollTop,
    setScrollTop,
  };
}
