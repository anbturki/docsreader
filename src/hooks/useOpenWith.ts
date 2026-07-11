import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { dirname } from "@/lib/path";

const OPEN_PATH_EVENT = "open-path";
const TAKE_OPENED_PATHS = "take_opened_paths";

export interface OpenTarget {
  path: string;
  isDir: boolean;
}

interface UseOpenWithOptions {
  // Wait until roots and panes are hydrated: opening before pane hydration
  // completes would let loadTabsState clobber the freshly opened tab.
  hydrated: boolean;
  roots: string[];
  addRoot: (path: string) => Promise<void>;
  selectRoot: (path: string | undefined) => Promise<void>;
  openFile: (path: string) => void;
}

function containingRoot(roots: string[], filePath: string): string | undefined {
  const norm = filePath.replace(/\\/g, "/");
  let best: string | undefined;
  for (const root of roots) {
    const r = root.replace(/\\/g, "/");
    if (norm === r || norm.startsWith(r + "/")) {
      if (!best || r.length > best.length) best = root;
    }
  }
  return best;
}

async function handleTarget(o: UseOpenWithOptions, target: OpenTarget): Promise<void> {
  if (target.isDir) {
    if (o.roots.includes(target.path)) await o.selectRoot(target.path);
    else await o.addRoot(target.path);
    return;
  }
  const existing = containingRoot(o.roots, target.path);
  if (existing) await o.selectRoot(existing);
  else await o.addRoot(dirname(target.path));
  o.openFile(target.path);
}

// Route files and folders opened through the OS ("Open With DocsReader",
// double-click a .md when DocsReader is the default) into the app. A folder
// becomes a workspace root; a file resolves to its enclosing root (or its
// parent folder as an ad-hoc root) and opens as a tab in the active pane.
export function useOpenWith(options: UseOpenWithOptions): void {
  const optsRef = useRef(options);
  optsRef.current = options;
  // Serialize handling so multiple targets arriving together don't race on
  // addRoot's shared root list.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!options.hydrated) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const enqueue = (targets: OpenTarget[]) => {
      queueRef.current = queueRef.current.then(async () => {
        for (const target of targets) {
          if (cancelled) return;
          try {
            await handleTarget(optsRef.current, target);
          } catch (err) {
            console.error("open-with failed", target, err);
          }
        }
      });
    };

    void (async () => {
      // Attach the listener before draining so an Opened event that fires
      // during startup is never lost between the two calls.
      unlisten = await listen<OpenTarget[]>(OPEN_PATH_EVENT, (e) => enqueue(e.payload));
      if (cancelled) {
        unlisten();
        return;
      }
      try {
        const initial = await invoke<OpenTarget[]>(TAKE_OPENED_PATHS);
        if (initial.length > 0) enqueue(initial);
      } catch (err) {
        console.error(`${TAKE_OPENED_PATHS} failed`, err);
      }
    })();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [options.hydrated]);
}
