import { useCallback, useEffect, useRef, useState } from "react";
import { loadPinned, savePinned, type PinnedByRoot } from "@/lib/storage";

export interface PinnedApi {
  hydrated: boolean;
  isPinned: (root: string, path: string) => boolean;
  togglePinned: (root: string, path: string) => void;
  pinnedFor: (root: string) => string[];
}

export function usePinned(): PinnedApi {
  const [pinned, setPinned] = useState<PinnedByRoot>({});
  const [hydrated, setHydrated] = useState(false);
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  const persistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hydratedRef = useRef(false);
  hydratedRef.current = hydrated;

  useEffect(() => {
    let cancelled = false;
    void loadPinned().then((p) => {
      if (cancelled) return;
      setPinned(p);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void savePinned(pinnedRef.current);
    }, 250);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [pinned, hydrated]);

  const isPinned = useCallback((root: string, path: string) => {
    return pinnedRef.current[root]?.includes(path) ?? false;
  }, []);

  const togglePinned = useCallback((root: string, path: string) => {
    setPinned((prev) => {
      const list = prev[root] ?? [];
      const next = list.includes(path) ? list.filter((p) => p !== path) : [...list, path];
      return { ...prev, [root]: next };
    });
  }, []);

  const pinnedFor = useCallback((root: string) => {
    return pinnedRef.current[root] ?? [];
  }, []);

  return { hydrated, isPinned, togglePinned, pinnedFor };
}
