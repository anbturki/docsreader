import { useCallback, useEffect, useMemo, useState } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useTasks } from "@/hooks/useTasks";
import { parseAcProgress, type AcProgress } from "@/lib/taskDoc";
import type { Task, TaskStatus } from "@/lib/tasks";
import { TaskBoardView } from "./TaskBoardView";
import { useCollapsedStatuses } from "./useCollapsedStatuses";

interface Props {
  activeRoot: string | undefined;
  query: string;
  selectedPath: string | undefined;
  onOpen: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
}

export function TasksBoard({
  activeRoot,
  query,
  selectedPath,
  onOpen,
  onOpenInNewTab,
  onOpenInOtherPane,
}: Props) {
  const { tasks, revision, loading, error, refresh, setStatus } = useTasks(activeRoot);
  const progress = useTaskProgress(tasks, revision);
  const { displayTasks, advancingIds, advanceError, advance } = useAdvance(tasks, setStatus);
  const { collapsed, toggle } = useCollapsedStatuses(activeRoot);

  return (
    <TaskBoardView
      tasks={displayTasks}
      query={query}
      progress={progress}
      loading={loading}
      error={advanceError ?? error}
      selectedPath={selectedPath}
      onRefresh={() => void refresh()}
      onOpen={onOpen}
      onOpenInNewTab={onOpenInNewTab}
      onOpenInOtherPane={onOpenInOtherPane}
      advancingIds={advancingIds}
      onAdvance={advance}
      collapsedStatuses={collapsed}
      onToggleStatus={toggle}
    />
  );
}

// Drag-to-advance with optimistic UI: the dragged card shows its new column
// immediately (via a status override), then the shared set_task_status write
// runs. On failure the override is dropped so the card rolls back, and the
// error surfaces inline.
function useAdvance(tasks: Task[], setStatus: (id: string, status: TaskStatus) => Promise<void>) {
  const [overrides, setOverrides] = useState<Map<string, TaskStatus>>(new Map());
  const [advancingIds, setAdvancingIds] = useState<Set<string>>(new Set());
  const [advanceError, setAdvanceError] = useState<string | undefined>();

  const displayTasks = useMemo(
    () =>
      overrides.size === 0
        ? tasks
        : tasks.map((t) => {
            const next = overrides.get(t.id);
            return next ? { ...t, status: next } : t;
          }),
    [tasks, overrides]
  );

  const advance = useCallback(
    (id: string, status: TaskStatus) => {
      const current = tasks.find((t) => t.id === id);
      if (!current || current.status === status) return;
      setOverrides((prev) => new Map(prev).set(id, status));
      setAdvancingIds((prev) => new Set(prev).add(id));
      setAdvanceError(undefined);
      void (async () => {
        try {
          await setStatus(id, status);
        } catch (e) {
          setAdvanceError(`Could not move ${id} to ${status}: ${String(e)}`);
        } finally {
          setOverrides((prev) => {
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
          setAdvancingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      })();
    },
    [tasks, setStatus]
  );

  return { displayTasks, advancingIds, advanceError, advance };
}

// AC progress is not in TaskSummary (list_tasks returns frontmatter only), so
// the board reads each task's body and reuses the Phase B parser rather than
// duplicating the AC scan in Rust.
function useTaskProgress(tasks: Task[], revision: number): Map<string, AcProgress> {
  const [progress, setProgress] = useState<Map<string, AcProgress>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        tasks.map(async (task) => {
          try {
            return [task.path, parseAcProgress(await readTextFile(task.path))] as const;
          } catch {
            return [task.path, { done: 0, total: 0 }] as const;
          }
        })
      );
      if (!cancelled) setProgress(new Map(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [tasks, revision]);

  return progress;
}
