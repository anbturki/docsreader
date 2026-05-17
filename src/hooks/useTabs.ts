import { useCallback, useEffect, useRef, useState } from "react";
import { readTextFile, watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { parseFrontmatter } from "@/lib/scan";
import { describeEventKind } from "@/lib/events";
import { basename } from "@/lib/path";
import { loadTabsState, saveTabsState, TABS_KEY_PANE0 } from "@/lib/storage";

export interface Tab {
  id: string;
  path: string;
  title: string;
  content: string;
  meta: Record<string, unknown>;
  error: string | undefined;
  loading: boolean;
  // Set by the per-tab watcher when the file on disk diverges from
  // `content`. While set, the document keeps showing `content` and the
  // ExternalChangeBanner offers Reload/Show diff/Dismiss. Cleared on
  // accept (reload) or close.
  pendingContent?: string;
  staleSince?: number;
  // Last raw disk content the user explicitly dismissed. While set,
  // further modify events that produce the same raw content stay
  // silent - dismissing means "I am OK reading the stale version,
  // stop nagging." A genuinely new content divergence clears this and
  // raises a fresh banner.
  dismissedContent?: string;
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
  acceptPending: (id: string) => void;
  dismissPending: (id: string) => void;
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

interface UseTabsOptions {
  autoReloadOnExternalChange: boolean;
  // Storage key used by both load + save. Default is the legacy
  // single-pane key, so existing users keep their state. Pane 1 in a
  // split layout passes a different key.
  storageKey?: string;
}

export function useTabs(options: UseTabsOptions): Tabs {
  const storageKey = options.storageKey ?? TABS_KEY_PANE0;
  const autoReloadRef = useRef(options.autoReloadOnExternalChange);
  autoReloadRef.current = options.autoReloadOnExternalChange;
  // Per-tab sequence counter. Each handleExternalModify call increments
  // its tab's counter and captures a local copy; if a newer event has
  // fired before the readTextFile await resolves, the older one's
  // result is dropped. Protects against out-of-order async completion.
  const modifySeqRef = useRef(new Map<string, number>());

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
      modifySeqRef.current.delete(id);
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

  // Accept the pending external change: replace tab.content with the
  // detected disk content and clear the pending state. Re-parses
  // frontmatter so the document re-renders with current metadata.
  const acceptPending = useCallback(
    (id: string) => {
      const current = tabsRef.current.find((t) => t.id === id);
      if (!current?.pendingContent) return;
      const { data, content } = parseFrontmatter(current.pendingContent);
      updateTab(id, {
        meta: data,
        content,
        pendingContent: undefined,
        staleSince: undefined,
        dismissedContent: undefined,
        error: undefined,
      });
    },
    [updateTab]
  );

  // Dismiss the banner without reloading. Tab keeps showing the prior
  // content. We remember the dismissed raw content so further modify
  // events that produce the same raw don't re-fire the banner; only a
  // genuinely new content divergence will.
  const dismissPending = useCallback(
    (id: string) => {
      const current = tabsRef.current.find((t) => t.id === id);
      const dismissedContent = current?.pendingContent;
      updateTab(id, {
        pendingContent: undefined,
        staleSince: undefined,
        dismissedContent,
      });
    },
    [updateTab]
  );

  // Read the disk content for an open tab and decide whether the
  // change is substantive. If the new content matches `current.content`
  // (touch-only modify), do nothing. Otherwise stash it as pendingContent
  // so the document can render the banner. When the user has opted into
  // silent auto-reload, skip the banner entirely.
  const handleExternalModify = useCallback(
    async (id: string, path: string) => {
      const seq = (modifySeqRef.current.get(id) ?? 0) + 1;
      modifySeqRef.current.set(id, seq);
      try {
        const raw = await readTextFile(path);
        // Drop stale completions if a newer modify event has fired in
        // the meantime - prevents out-of-order async overwrites.
        if (modifySeqRef.current.get(id) !== seq) return;

        const current = tabsRef.current.find((t) => t.id === id);
        if (!current || current.path !== path) return;

        const reparsed = parseFrontmatter(raw);

        // Body unchanged. Could be a touch (mtime only) or a
        // frontmatter-only change. Either way, refresh meta silently
        // and clear any banner that was outstanding (the user reverted
        // the external change before deciding). Also clear
        // dismissedContent - the file is back in sync.
        if (reparsed.content === current.content) {
          const patch: Partial<Tab> = { meta: reparsed.data };
          if (
            current.pendingContent !== undefined ||
            current.dismissedContent !== undefined
          ) {
            patch.pendingContent = undefined;
            patch.staleSince = undefined;
            patch.dismissedContent = undefined;
          }
          updateTab(id, patch);
          return;
        }

        // Body diverged. Either silent-reload (per user setting) or
        // raise the banner.
        if (autoReloadRef.current) {
          updateTab(id, {
            meta: reparsed.data,
            content: reparsed.content,
            error: undefined,
            loading: false,
            pendingContent: undefined,
            staleSince: undefined,
            dismissedContent: undefined,
          });
          return;
        }

        // The user already dismissed this exact raw content. Stay
        // silent - they're reading the prior version on purpose.
        if (raw === current.dismissedContent) return;
        // Already-pending duplicate event; nothing new to show.
        if (raw === current.pendingContent) return;
        updateTab(id, {
          pendingContent: raw,
          staleSince: Date.now(),
        });
      } catch (err) {
        console.error("external modify read failed", err);
      }
    },
    [updateTab]
  );

  // When the user toggles on auto-reload, any outstanding banners
  // become inconsistent (new modifies will silently reload while the
  // banner still shows old comparison data). Clear all pending state.
  useEffect(() => {
    if (!options.autoReloadOnExternalChange) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.pendingContent === undefined &&
        t.staleSince === undefined &&
        t.dismissedContent === undefined
          ? t
          : {
              ...t,
              pendingContent: undefined,
              staleSince: undefined,
              dismissedContent: undefined,
            }
      )
    );
  }, [options.autoReloadOnExternalChange]);

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
              if (!current || current.path !== tab.path) return;
              // Modify: surface as a pending external change so the
              // user gets to consent before the rendered content shifts.
              // Create/rename: file was replaced - full reload.
              if (kind === "modify") {
                void handleExternalModify(tab.id, tab.path);
              } else {
                void loadTab(tab.id, tab.path);
              }
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
  }, [tabs, loadTab, handleExternalModify]);

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
      void saveTabsState(
        {
          paths: currentTabs.map((t) => t.path),
          activePath: active?.path,
          scrollByPath: trimmedScroll,
        },
        storageKey
      );
    }, delay);
  }, [storageKey]);

  useEffect(() => {
    let cancelled = false;
    void loadTabsState(storageKey).then((state) => {
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
  }, [loadTab, storageKey]);

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
    acceptPending,
    dismissPending,
    getScrollTop,
    setScrollTop,
  };
}
