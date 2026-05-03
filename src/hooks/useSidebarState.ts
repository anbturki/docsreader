import { useCallback, useEffect, useRef, useState } from "react";
import { loadSidebarState, saveSidebarState } from "@/lib/storage";

const DEFAULT_OPEN_DEPTH = 1;

export interface SidebarStateApi {
  hydrated: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  isExpanded: (key: string, depth: number) => boolean;
  toggleExpanded: (key: string, currentlyOpen: boolean) => void;
  collapseAll: (keys: string[]) => void;
}

export function useSidebarState(): SidebarStateApi {
  const [open, setOpenState] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef({ open, expanded });
  stateRef.current = { open, expanded };
  const persistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hydratedRef = useRef(false);
  hydratedRef.current = hydrated;

  useEffect(() => {
    let cancelled = false;
    void loadSidebarState().then((s) => {
      if (cancelled) return;
      setOpenState(s.open);
      setExpanded(s.expanded);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const schedulePersist = useCallback(() => {
    if (!hydratedRef.current) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void saveSidebarState({ ...stateRef.current });
    }, 250);
  }, []);

  useEffect(() => {
    if (hydrated) schedulePersist();
  }, [open, expanded, hydrated, schedulePersist]);

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  const setOpen = useCallback((v: boolean) => setOpenState(v), []);

  const isExpanded = useCallback((key: string, depth: number) => {
    const explicit = stateRef.current.expanded[key];
    if (typeof explicit === "boolean") return explicit;
    return depth < DEFAULT_OPEN_DEPTH;
  }, []);

  const toggleExpanded = useCallback((key: string, currentlyOpen: boolean) => {
    setExpanded((prev) => ({ ...prev, [key]: !currentlyOpen }));
  }, []);

  const collapseAll = useCallback((keys: string[]) => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = false;
      return next;
    });
  }, []);

  return { hydrated, open, setOpen, isExpanded, toggleExpanded, collapseAll };
}
