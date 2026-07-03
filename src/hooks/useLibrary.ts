import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import {
  scanDirectory,
  type ScanProgress,
  type ScanResult,
} from "@/lib/scan";
import { fetchGitStatus, type GitStatus } from "@/lib/git";
import { describeEventKind } from "@/lib/events";
import {
  addDismissedRegistry,
  deleteScanCache,
  loadDismissedRegistry,
  loadLastSelected,
  loadRoots,
  loadScanCache,
  removeDismissedRegistry,
  saveLastSelected,
  saveRoots,
  saveScanCache,
} from "@/lib/storage";
import { listRegistryWorkspaces, registryDir } from "@/lib/workspaces";

export interface RootScan {
  result: ScanResult;
  scanning: boolean;
  progress?: ScanProgress;
  startedAt?: number;
  finishedAt?: number;
  cachedAt?: number;
  gitStatus?: GitStatus;
}

export interface Library {
  roots: string[];
  activeRoot: string | undefined;
  scans: Record<string, RootScan>;
  activeScan: RootScan | undefined;
  hydrated: boolean;
  pickDirectory: () => Promise<void>;
  addRoot: (path: string) => Promise<void>;
  removeRoot: (path: string) => Promise<void>;
  selectRoot: (path: string | undefined) => Promise<void>;
  rescan: (root: string) => Promise<void>;
}

const emptyResult = (root: string): ScanResult => ({ root, files: [], truncated: false });

// Debounce window after the most recent event before a rescan fires.
const DEBOUNCE_MS = 600;
// Minimum gap between two rescans regardless of how many events fire.
const MIN_RESCAN_INTERVAL_MS = 2000;
// Coalescing window the fs watcher applies before delivering events.
const WATCH_DELAY_MS = 200;

// Mirror of the Rust scanner's SKIP_DIRS in src-tauri/core/src/scan.rs. Any
// directory segment in this set, OR any segment that starts with a dot
// (other than "." and ".."), causes a watch event for that path to be
// dropped without scheduling a rescan. The scanner already excludes
// these paths, so a rescan triggered by them produces no new data.
const SKIP_DIR_BASENAMES = new Set([
  "node_modules",
  "target",
  ".git",
  ".next",
  "dist",
  "build",
  ".venv",
  "venv",
  ".cache",
  ".turbo",
  ".vercel",
  ".idea",
  ".vscode",
  "Library",
  "Applications",
  "System",
  "Pictures",
  "Movies",
  "Music",
  ".Trash",
  ".npm",
  ".yarn",
  ".pnpm-store",
  ".cargo",
  ".rustup",
  ".bun",
  ".local",
  "Pods",
  ".gradle",
  "DerivedData",
]);

function isSkippedWatchPath(eventPath: string, root: string): boolean {
  const norm = eventPath.replace(/\\/g, "/");
  const r = root.replace(/\\/g, "/");
  let rel: string;
  if (norm === r) return false;
  if (norm.startsWith(r + "/")) rel = norm.slice(r.length + 1);
  else rel = norm; // event outside root: treat as relevant, not our problem
  for (const seg of rel.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg.startsWith(".") && seg !== "..") return true;
    if (SKIP_DIR_BASENAMES.has(seg)) return true;
  }
  return false;
}

// True when the watch event refers to the workspace marker (or a legacy
// manifest awaiting migration) at the workspace root. We watch modifies for
// it specifically because edits change the workspace name/homepage even when
// no files come/go.
const MANIFEST_BASENAMES = [".docsreader.yaml", ".docs.yaml", "docs.yaml"] as const;

function isManifestPath(eventPath: string, root: string): boolean {
  const norm = eventPath.replace(/\\/g, "/");
  const r = root.replace(/\\/g, "/");
  return MANIFEST_BASENAMES.some((name) => norm === `${r}/${name}`);
}

export function useLibrary(): Library {
  const [roots, setRoots] = useState<string[]>([]);
  const [activeRoot, setActiveRoot] = useState<string | undefined>();
  const [scans, setScans] = useState<Record<string, RootScan>>({});
  const [hydrated, setHydrated] = useState(false);

  // Mirror of `roots` for reads inside async callbacks (reconcile, watcher)
  // that must see the latest list without re-subscribing. Every mutation
  // path (addRoot/removeRoot/reconcile) writes it synchronously before its
  // setRoots, so the no-await sections stay race-free against each other.
  const rootsRef = useRef<string[]>(roots);
  rootsRef.current = roots;

  // Paths currently in the MCP registry, from the last reconcile. Used so
  // removeRoot only tombstones actual registry workspaces, not manually
  // added folders.
  const registryPathsRef = useRef<Set<string>>(new Set());

  const hydrateFromCache = useCallback(async (root: string) => {
    const cached = await loadScanCache(root);
    if (!cached) return;
    setScans((s) => ({
      ...s,
      [root]: { result: cached.result, scanning: false, cachedAt: cached.cachedAt },
    }));
  }, []);

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
          gitStatus: s[root]?.gitStatus,
        },
      }));
      // Refresh git status after the scan completes. Runs in the
      // background; if the workspace is not a git repo, this resolves
      // to undefined silently.
      void fetchGitStatus(root).then((gitStatus) => {
        setScans((s) => {
          const prev = s[root];
          if (!prev) return s;
          return { ...s, [root]: { ...prev, gitStatus } };
        });
      });
    } catch (err) {
      console.error(err);
      setScans((s) => {
        const prev = s[root];
        const result = prev?.result ?? emptyResult(root);
        return { ...s, [root]: { ...prev, result, scanning: false, startedAt } };
      });
    }
  }, []);

  // Merge workspaces the MCP server created (agents write to ~/notes and
  // project-scoped folders, recorded in ~/.docsreader/workspaces.json) into
  // the displayed roots, so agent-created workspaces stop being invisible.
  // Skips ones already shown and ones the user explicitly removed. Never
  // changes the active root or the persisted selection.
  const reconcileRegistry = useCallback(async () => {
    let registry: Awaited<ReturnType<typeof listRegistryWorkspaces>>;
    try {
      registry = await listRegistryWorkspaces();
    } catch (err) {
      console.error("read workspace registry failed", err);
      return;
    }
    registryPathsRef.current = new Set(registry.map((w) => w.path));
    const dismissed = new Set(await loadDismissedRegistry());
    const shown = new Set(rootsRef.current);
    const additions = registry
      .map((w) => w.path)
      .filter((p) => !shown.has(p) && !dismissed.has(p));
    if (additions.length === 0) return;
    const wasEmpty = rootsRef.current.length === 0;
    const next = [...rootsRef.current, ...additions];
    rootsRef.current = next;
    setRoots(next);
    await saveRoots(next);
    // When the app had nothing open, select the first synced workspace so
    // the reported empty-app case lands on a doc instead of a blank pane.
    if (wasEmpty) {
      setActiveRoot(additions[0]);
      await saveLastSelected(additions[0]);
    }
    for (const path of additions) {
      void hydrateFromCache(path);
      void rescan(path);
    }
  }, [hydrateFromCache, rescan]);

  useEffect(() => {
    (async () => {
      const [stored, last] = await Promise.all([loadRoots(), loadLastSelected()]);
      setRoots(stored);
      rootsRef.current = stored;
      if (stored.length > 0) {
        const initial = stored.includes(last ?? "") ? (last as string) : stored[0];
        setActiveRoot(initial);
        await hydrateFromCache(initial);
      }
      setHydrated(true);
      await reconcileRegistry();
    })();
  }, [hydrateFromCache, reconcileRegistry]);

  const addRoot = useCallback(
    async (path: string) => {
      // A manual re-add of a previously removed registry workspace clears
      // its dismissal, so future syncs keep showing it.
      void removeDismissedRegistry(path);
      if (!rootsRef.current.includes(path)) {
        const next = [...rootsRef.current, path];
        rootsRef.current = next;
        setRoots(next);
        void saveRoots(next);
      }
      setActiveRoot(path);
      await saveLastSelected(path);
      await hydrateFromCache(path);
      void rescan(path);
    },
    [hydrateFromCache, rescan]
  );

  const pickDirectory = useCallback(async () => {
    const picked = await open({ directory: true, multiple: false, title: "Select docs folder" });
    if (!picked || typeof picked !== "string") return;
    await addRoot(picked);
  }, [addRoot]);

  const removeRoot = useCallback(
    async (path: string) => {
      // Tombstone only actual registry workspaces, so a synced workspace
      // does not reappear on the next launch while a manually added folder
      // leaves no lingering suppression. addRoot clears the tombstone. The
      // workspace and its files on disk are untouched either way.
      if (registryPathsRef.current.has(path)) void addDismissedRegistry(path);
      const nextRoots = rootsRef.current.filter((r) => r !== path);
      rootsRef.current = nextRoots;
      setRoots(nextRoots);
      void saveRoots(nextRoots);
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
    async (path: string | undefined) => {
      setActiveRoot(path);
      await saveLastSelected(path);
      if (path && !scans[path]) await hydrateFromCache(path);
    },
    [scans, hydrateFromCache]
  );

  // Workspace-level watcher: re-scan the active root when files or
  // folders are created, removed, or renamed anywhere inside it.
  // Modify-only events for individual files are handled per-tab in
  // useTabs, so they're ignored here to avoid redundant scans.
  //
  // Two filters protect against runaway work:
  //   1. Events whose path lies inside a hidden or known-noisy
  //      directory are dropped before scheduling. These mirror the
  //      Rust scanner's skip list (src-tauri/core/src/scan.rs SKIP_DIRS),
  //      so the scan would have ignored those paths anyway.
  //   2. Rescans are rate-limited to one every MIN_RESCAN_INTERVAL_MS
  //      regardless of debounce, so sustained churn cannot loop the
  //      scanner faster than the user can browse.
  const rescanRef = useRef(rescan);
  rescanRef.current = rescan;
  useEffect(() => {
    if (!activeRoot) return;
    let cancelled = false;
    let unwatch: UnwatchFn | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let gitDebounceTimer: ReturnType<typeof setTimeout> | undefined;
    let lastRescanAt = 0;

    const scheduleRescan = () => {
      if (cancelled) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      const elapsed = Date.now() - lastRescanAt;
      const wait = Math.max(DEBOUNCE_MS, MIN_RESCAN_INTERVAL_MS - elapsed);
      debounceTimer = setTimeout(() => {
        if (cancelled) return;
        lastRescanAt = Date.now();
        void rescanRef.current(activeRoot);
      }, wait);
    };

    // Lighter than scheduleRescan: refreshes only the workspace's git
    // status without re-walking the file tree. Used when a modify
    // event lands on a file inside the workspace but not the manifest -
    // the file set is unchanged but the git modified/clean state may
    // have flipped.
    const scheduleGitRefresh = () => {
      if (cancelled) return;
      if (gitDebounceTimer) clearTimeout(gitDebounceTimer);
      gitDebounceTimer = setTimeout(() => {
        if (cancelled) return;
        void fetchGitStatus(activeRoot).then((gitStatus) => {
          if (cancelled) return;
          setScans((s) => {
            const prev = s[activeRoot];
            if (!prev) return s;
            return { ...s, [activeRoot]: { ...prev, gitStatus } };
          });
        });
      }, DEBOUNCE_MS);
    };

    void (async () => {
      try {
        const unwatchFn = await watch(
          activeRoot,
          (event) => {
            const kind = describeEventKind(event.type);
            const paths = Array.isArray(event.paths) ? event.paths : [];

            // Manifest events bypass both the modify-skip and the
            // dotfile-skip filters. The dotfile filter would otherwise
            // drop create/remove/rename of the marker file because of its
            // leading dot, and the modify-skip would drop in-place edits.
            const manifestTouched = paths.some((p) =>
              isManifestPath(p, activeRoot)
            );
            if (
              manifestTouched &&
              (kind === "create" ||
                kind === "remove" ||
                kind === "rename" ||
                kind === "modify")
            ) {
              scheduleRescan();
              return;
            }

            // Modify events on regular workspace files: skip the rescan
            // (file set hasn't changed) but refresh git status so the
            // file-tree decorations stay live.
            if (kind === "modify") {
              const someRelevant =
                paths.length === 0 ||
                paths.some((p) => !isSkippedWatchPath(p, activeRoot));
              if (someRelevant) scheduleGitRefresh();
              return;
            }

            if (kind !== "create" && kind !== "remove" && kind !== "rename") {
              return;
            }
            // event.paths can contain multiple paths for batched events.
            // Only schedule a rescan if at least one path is not skipped.
            const someRelevant =
              paths.length === 0 ||
              paths.some((p) => !isSkippedWatchPath(p, activeRoot));
            if (someRelevant) scheduleRescan();
          },
          { recursive: true, delayMs: WATCH_DELAY_MS }
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
      if (gitDebounceTimer) clearTimeout(gitDebounceTimer);
      if (unwatch) void unwatch();
    };
  }, [activeRoot]);

  // Registry watcher: when an agent creates a workspace while the app is
  // open, ~/.docsreader/workspaces.json changes and the new workspace
  // appears without a restart. A window-focus pass is the fallback for the
  // rare case the directory did not exist when the watch was set up.
  useEffect(() => {
    let cancelled = false;
    let unwatch: UnwatchFn | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleReconcile = () => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!cancelled) void reconcileRegistry();
      }, DEBOUNCE_MS);
    };

    void (async () => {
      try {
        const dir = await registryDir();
        const unwatchFn = await watch(dir, scheduleReconcile, {
          recursive: false,
          delayMs: WATCH_DELAY_MS,
        });
        if (cancelled) {
          void unwatchFn();
          return;
        }
        unwatch = unwatchFn;
      } catch (err) {
        // The registry dir may not exist until the first agent write; the
        // focus fallback and next launch still pick new workspaces up.
        console.debug("registry watch not active yet", err);
      }
    })();

    window.addEventListener("focus", scheduleReconcile);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", scheduleReconcile);
      if (unwatch) void unwatch();
    };
  }, [reconcileRegistry]);

  const activeScan = activeRoot ? scans[activeRoot] : undefined;

  return {
    roots,
    activeRoot,
    scans,
    activeScan,
    hydrated,
    pickDirectory,
    addRoot,
    removeRoot,
    selectRoot,
    rescan,
  };
}
