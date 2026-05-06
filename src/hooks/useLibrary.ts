import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import {
  scanDirectory,
  type ScanProgress,
  type ScanResult,
} from "@/lib/scan";
import { describeEventKind } from "@/lib/events";
import {
  deleteScanCache,
  loadLastSelected,
  loadRoots,
  loadScanCache,
  saveLastSelected,
  saveRoots,
  saveScanCache,
} from "@/lib/storage";

export interface RootScan {
  result: ScanResult;
  scanning: boolean;
  progress?: ScanProgress;
  startedAt?: number;
  finishedAt?: number;
  cachedAt?: number;
}

export interface Library {
  roots: string[];
  activeRoot: string | undefined;
  scans: Record<string, RootScan>;
  activeScan: RootScan | undefined;
  pickDirectory: () => Promise<void>;
  removeRoot: (path: string) => Promise<void>;
  selectRoot: (path: string) => Promise<void>;
  rescan: (root: string) => Promise<void>;
}

const emptyResult = (root: string): ScanResult => ({ root, files: [], truncated: false });

export function useLibrary(): Library {
  const [roots, setRoots] = useState<string[]>([]);
  const [activeRoot, setActiveRoot] = useState<string | undefined>();
  const [scans, setScans] = useState<Record<string, RootScan>>({});

  const hydrateFromCache = useCallback(async (root: string) => {
    const cached = await loadScanCache(root);
    if (!cached) return;
    setScans((s) => ({
      ...s,
      [root]: { result: cached.result, scanning: false, cachedAt: cached.cachedAt },
    }));
  }, []);

  useEffect(() => {
    (async () => {
      const [stored, last] = await Promise.all([loadRoots(), loadLastSelected()]);
      setRoots(stored);
      if (stored.length > 0) {
        const initial = stored.includes(last ?? "") ? (last as string) : stored[0];
        setActiveRoot(initial);
        await hydrateFromCache(initial);
      }
    })();
  }, [hydrateFromCache]);

  const rescan = useCallback(async (root: string) => {
    const startedAt = performance.now();
    setScans((s) => {
      const prev = s[root];
      const result = prev?.result ?? emptyResult(root);
      return {
        ...s,
        [root]: { ...prev, result, scanning: true, startedAt, progress: undefined },
      };
    });
    try {
      const result = await scanDirectory(root, (progress) => {
        setScans((s) => {
          const prev = s[root];
          if (!prev) return s;
          return { ...s, [root]: { ...prev, progress } };
        });
      });
      void saveScanCache(root, result).catch(console.error);
      setScans((s) => ({
        ...s,
        [root]: {
          result,
          scanning: false,
          startedAt,
          finishedAt: performance.now(),
          progress: s[root]?.progress,
          cachedAt: Date.now(),
        },
      }));
    } catch (err) {
      console.error(err);
      setScans((s) => {
        const prev = s[root];
        const result = prev?.result ?? emptyResult(root);
        return { ...s, [root]: { ...prev, result, scanning: false, startedAt } };
      });
    }
  }, []);

  const pickDirectory = useCallback(async () => {
    const picked = await open({ directory: true, multiple: false, title: "Select docs folder" });
    if (!picked || typeof picked !== "string") return;
    setRoots((prev) => {
      if (prev.includes(picked)) return prev;
      const next = [...prev, picked];
      void saveRoots(next);
      return next;
    });
    setActiveRoot(picked);
    await saveLastSelected(picked);
    await hydrateFromCache(picked);
    void rescan(picked);
  }, [hydrateFromCache, rescan]);

  const removeRoot = useCallback(
    async (path: string) => {
      let nextRoots: string[] = [];
      setRoots((prev) => {
        nextRoots = prev.filter((r) => r !== path);
        void saveRoots(nextRoots);
        return nextRoots;
      });
      await deleteScanCache(path);
      setScans((s) => {
        const c = { ...s };
        delete c[path];
        return c;
      });
      setActiveRoot((current) => {
        if (current !== path) return current;
        const fallback = nextRoots[0];
        void saveLastSelected(fallback);
        if (fallback) void hydrateFromCache(fallback);
        return fallback;
      });
    },
    [hydrateFromCache]
  );

  const selectRoot = useCallback(
    async (path: string) => {
      setActiveRoot(path);
      await saveLastSelected(path);
      if (!scans[path]) await hydrateFromCache(path);
    },
    [scans, hydrateFromCache]
  );

  // Workspace-level watcher: re-scan the active root when files or
  // folders are created, removed, or renamed anywhere inside it.
  // Modify-only events for individual files are handled per-tab in
  // useTabs, so they're ignored here to avoid redundant scans.
  const rescanRef = useRef(rescan);
  rescanRef.current = rescan;
  useEffect(() => {
    if (!activeRoot) return;
    let cancelled = false;
    let unwatch: UnwatchFn | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleRescan = () => {
      if (cancelled) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!cancelled) void rescanRef.current(activeRoot);
      }, 600);
    };

    void (async () => {
      try {
        const unwatchFn = await watch(
          activeRoot,
          (event) => {
            const kind = describeEventKind(event.type);
            if (kind === "create" || kind === "remove" || kind === "rename") {
              scheduleRescan();
            }
          },
          { recursive: true, delayMs: 200 }
        );
        if (cancelled) {
          void unwatchFn();
          return;
        }
        unwatch = unwatchFn;
      } catch (err) {
        console.error("workspace watch failed", err);
      }
    })();

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (unwatch) void unwatch();
    };
  }, [activeRoot]);

  const activeScan = activeRoot ? scans[activeRoot] : undefined;

  return {
    roots,
    activeRoot,
    scans,
    activeScan,
    pickDirectory,
    removeRoot,
    selectRoot,
    rescan,
  };
}
