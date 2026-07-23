import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useTasks } from "@/hooks/useTasks";
import { parseAcProgress, type AcProgress } from "@/lib/taskDoc";
import type { Task, TaskStatus } from "@/lib/tasks";
import {
  availableLabels,
  filterTasks,
  isFilterActive,
  type TaskFilter,
} from "@/lib/taskFilter";
import { useTaskFilter } from "@/components/explorer/TaskFilterContext";
import type { TaskViewProps } from "./taskViewProps";
import { useCollapsedStatuses } from "./useCollapsedStatuses";

interface Props {
  // The lens fills whatever box it is given: a scrolling sidebar column, or a
  // pane that hands it the leftover height.
  className?: string;
  /** How the narrowed tasks are drawn. The caller owns the choice. */
  view: ComponentType<TaskViewProps>;
  activeRoot: string | undefined;
  query: string;
  refreshSignal: number;
  selectedPath: string | undefined;
  onOpen: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
}

export function TasksLens({
  className,
  view: View,
  activeRoot,
  query,
  refreshSignal,
  selectedPath,
  onOpen,
  onOpenInNewTab,
  onOpenInOtherPane,
}: Props) {
  const { tasks, revision, loading, error, setStatus } = useTasks(activeRoot, refreshSignal);
  const progress = useTaskProgress(tasks, revision);
  const { displayTasks, advancingIds, advanceError, advance } = useAdvance(tasks, setStatus);
  const { collapsed, toggle } = useCollapsedStatuses(activeRoot);
  const { filtered, searching } = usePublishedFilter(displayTasks, query);

  const shownError = advanceError ?? error;

  return (
    <div className={cn("flex flex-col", className)} data-slot="tasks-lens">
      {shownError && <p className="px-3 py-2 text-xs text-destructive">{shownError}</p>}
      {loading && displayTasks.length === 0 ? (
        <TasksSkeleton />
      ) : filtered.length === 0 ? (
        <Empty className="my-auto">
          <EmptyHeader>
            <EmptyTitle>{searching ? "No matching tasks" : "No tasks"}</EmptyTitle>
            <EmptyDescription>
              {searching
                ? "Adjust the search or filters above."
                : "Agents create tasks in tasks/ via MCP."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <View
          tasks={filtered}
          searching={searching}
          progress={progress}
          selectedPath={selectedPath}
          onOpen={onOpen}
          onOpenInNewTab={onOpenInNewTab}
          onOpenInOtherPane={onOpenInOtherPane}
          advancingIds={advancingIds}
          onAdvance={advance}
          collapsedStatuses={collapsed}
          onToggleStatus={toggle}
        />
      )}
    </div>
  );
}

// The lens owns the narrowing so every view shows the same set, and so the
// header's label choices and count stay published whichever view is active.
function usePublishedFilter(tasks: Task[], query: string) {
  const { filter, setLabels, setCount } = useTaskFilter();

  const labels = useMemo(() => availableLabels(tasks), [tasks]);
  useEffect(() => setLabels(labels), [labels, setLabels]);

  const activeFilter = useMemo<TaskFilter>(() => ({ ...filter, text: query }), [filter, query]);
  const filtered = useMemo(() => filterTasks(tasks, activeFilter), [tasks, activeFilter]);

  const shown = filtered.length;
  const total = tasks.length;
  useEffect(() => {
    setCount({ shown, total });
    return () => setCount(undefined);
  }, [shown, total, setCount]);

  return { filtered, searching: isFilterActive(activeFilter) };
}

function TasksSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
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
