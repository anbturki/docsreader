import { useCallback, useEffect, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("docsreader.settings.json");
const DISMISSED_KEY = "updater.dismissedVersion";
const INITIAL_CHECK_DELAY_MS = 5_000;
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000;

export type UpdaterPhase =
  | "idle"
  | "available"
  | "downloading"
  | "installing"
  | "ready-to-relaunch"
  | "error";

export interface UpdaterState {
  phase: UpdaterPhase;
  pendingVersion?: string;
  currentVersion?: string;
  notes?: string;
  progressBytes?: number;
  totalBytes?: number;
  error?: string;
}

export interface UpdaterControls {
  install: () => Promise<void>;
  dismiss: () => Promise<void>;
}

export function useUpdater(): UpdaterState & UpdaterControls {
  const [state, setState] = useState<UpdaterState>({ phase: "idle" });
  const updateRef = useRef<Update | null>(null);
  const dismissedRef = useRef<string | null>(null);

  const runCheck = useCallback(async () => {
    try {
      const update = await check();
      if (!update) {
        if (updateRef.current) {
          updateRef.current.close().catch(() => undefined);
          updateRef.current = null;
        }
        setState({ phase: "idle" });
        return;
      }
      // Respect prior dismissal for the same version. A newer version
      // supersedes the dismissal.
      if (dismissedRef.current && dismissedRef.current === update.version) {
        update.close().catch(() => undefined);
        return;
      }
      updateRef.current = update;
      setState({
        phase: "available",
        pendingVersion: update.version,
        currentVersion: update.currentVersion,
        notes: update.body,
      });
    } catch (err) {
      // Network / signature errors are non-fatal: keep the app usable.
      // Surface only if no update was already detected.
      setState((prev) =>
        prev.phase === "available" || prev.phase === "downloading" || prev.phase === "installing"
          ? prev
          : { phase: "error", error: err instanceof Error ? err.message : String(err) }
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    (async () => {
      dismissedRef.current = ((await store.get<string>(DISMISSED_KEY)) ?? null);
      if (cancelled) return;
      const initial = setTimeout(runCheck, INITIAL_CHECK_DELAY_MS);
      interval = setInterval(runCheck, RECHECK_INTERVAL_MS);
      return () => {
        clearTimeout(initial);
      };
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (updateRef.current) {
        updateRef.current.close().catch(() => undefined);
        updateRef.current = null;
      }
    };
  }, [runCheck]);

  const install = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;
    setState((prev) => ({ ...prev, phase: "downloading", progressBytes: 0 }));
    try {
      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          setState((prev) => ({
            ...prev,
            phase: "downloading",
            progressBytes: 0,
            totalBytes: event.data.contentLength,
          }));
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setState((prev) => ({ ...prev, progressBytes: downloaded }));
        } else if (event.event === "Finished") {
          setState((prev) => ({ ...prev, phase: "installing" }));
        }
      });
      setState((prev) => ({ ...prev, phase: "ready-to-relaunch" }));
      await relaunch();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const dismiss = useCallback(async () => {
    const version = updateRef.current?.version;
    if (version) {
      dismissedRef.current = version;
      await store.set(DISMISSED_KEY, version);
      await store.save();
    }
    if (updateRef.current) {
      updateRef.current.close().catch(() => undefined);
      updateRef.current = null;
    }
    setState({ phase: "idle" });
  }, []);

  return { ...state, install, dismiss };
}
