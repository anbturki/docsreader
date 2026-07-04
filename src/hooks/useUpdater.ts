import { useCallback, useEffect, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("docsreader.settings.json");
const DISMISSED_KEY = "updater.dismissedVersion";
const INITIAL_CHECK_DELAY_MS = 5_000;
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000;

export const UPDATER_PHASES = [
  "idle",
  "checking",
  "available",
  "downloading",
  "installing",
  "ready-to-relaunch",
  "up-to-date",
  "error",
] as const;
export type UpdaterPhase = (typeof UPDATER_PHASES)[number];

export interface UpdaterState {
  phase: UpdaterPhase;
  pendingVersion?: string;
  currentVersion?: string;
  notes?: string;
  progressBytes?: number;
  totalBytes?: number;
  error?: string;
  lastCheckedAt?: number;
}

export interface UpdaterControls {
  install: () => Promise<void>;
  dismiss: () => Promise<void>;
  checkNow: () => Promise<void>;
}

export function useUpdater(): UpdaterState & UpdaterControls {
  const [state, setState] = useState<UpdaterState>({ phase: "idle" });
  const updateRef = useRef<Update | null>(null);
  const dismissedRef = useRef<string | null>(null);
  const checkingRef = useRef(false);

  const runCheck = useCallback(async (manual: boolean) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    // A manual check means the user wants to see updates now, even one they
    // dismissed earlier.
    if (manual) {
      dismissedRef.current = null;
      setState((prev) => ({ ...prev, phase: "checking", error: undefined }));
    }
    try {
      const update = await check();
      const checkedAt = Date.now();
      if (!update) {
        if (updateRef.current) {
          updateRef.current.close().catch(() => undefined);
          updateRef.current = null;
        }
        setState((prev) => ({
          phase: manual ? "up-to-date" : "idle",
          currentVersion: prev.currentVersion,
          lastCheckedAt: checkedAt,
        }));
        return;
      }
      if (!manual && dismissedRef.current === update.version) {
        update.close().catch(() => undefined);
        setState((prev) => ({ ...prev, lastCheckedAt: checkedAt }));
        return;
      }
      updateRef.current = update;
      setState((prev) => ({
        phase: "available",
        pendingVersion: update.version,
        currentVersion: update.currentVersion ?? prev.currentVersion,
        notes: update.body,
        lastCheckedAt: checkedAt,
      }));
    } catch (err) {
      // Never clobber an update that's already mid-flight. Background failures
      // (offline, feed hiccup) stay silent; only a manual check surfaces them.
      setState((prev) =>
        prev.phase === "available" || prev.phase === "downloading" || prev.phase === "installing"
          ? prev
          : {
              phase: manual ? "error" : "idle",
              currentVersion: prev.currentVersion,
              lastCheckedAt: Date.now(),
              error: manual ? (err instanceof Error ? err.message : String(err)) : undefined,
            }
      );
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let initial: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        const version = await getVersion();
        if (!cancelled) {
          setState((prev) => ({ ...prev, currentVersion: prev.currentVersion ?? version }));
        }
      } catch {
        // Version is a nicety for the About panel; ignore if unavailable.
      }
      dismissedRef.current = (await store.get<string>(DISMISSED_KEY)) ?? null;
      if (cancelled) return;
      initial = setTimeout(() => void runCheck(false), INITIAL_CHECK_DELAY_MS);
      interval = setInterval(() => void runCheck(false), RECHECK_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (initial) clearTimeout(initial);
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
    setState((prev) => ({ phase: "idle", currentVersion: prev.currentVersion, lastCheckedAt: prev.lastCheckedAt }));
  }, []);

  const checkNow = useCallback(() => runCheck(true), [runCheck]);

  return { ...state, install, dismiss, checkNow };
}
