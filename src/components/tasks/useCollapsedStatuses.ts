import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadCollapsedTaskStatuses,
  saveCollapsedTaskStatuses,
  type CollapsedTaskStatusesByRoot,
} from "@/lib/storage";
import type { TaskStatus } from "@/lib/tasks";

const NONE: ReadonlySet<TaskStatus> = new Set<TaskStatus>();

export interface CollapsedStatusesApi {
  collapsed: ReadonlySet<TaskStatus>;
  toggle: (status: TaskStatus) => void;
}

export function useCollapsedStatuses(root: string | undefined): CollapsedStatusesApi {
  const [byRoot, setByRoot] = useState<CollapsedTaskStatusesByRoot>({});
  const byRootRef = useRef(byRoot);
  byRootRef.current = byRoot;
  const touched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadCollapsedTaskStatuses().then((stored) => {
      if (cancelled || touched.current) return;
      setByRoot(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const collapsed = useMemo(
    () => (root ? new Set(byRoot[root] ?? []) : NONE),
    [byRoot, root]
  );

  const toggle = useCallback(
    (status: TaskStatus) => {
      if (!root) return;
      touched.current = true;
      const current = byRootRef.current[root] ?? [];
      const next = current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status];
      const updated = { ...byRootRef.current, [root]: next };
      byRootRef.current = updated;
      setByRoot(updated);
      void saveCollapsedTaskStatuses(updated);
    },
    [root]
  );

  return { collapsed, toggle };
}
