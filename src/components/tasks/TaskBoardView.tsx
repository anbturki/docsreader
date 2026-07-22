import { useEffect, useId, useMemo, useState } from "react";
import { ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/lib/tasks";
import type { AcProgress } from "@/lib/taskDoc";
import {
  availableLabels,
  filterTasks,
  isFilterActive,
  type TaskFilter,
} from "@/lib/taskFilter";
import { STATUS_STYLES } from "@/lib/taskStyles";
import { useTaskFilter } from "@/components/explorer/TaskFilterContext";
import { TaskCard } from "./TaskCard";

interface Props {
  tasks: Task[];
  /** The shared sidebar query, matched against task titles and ids. */
  query?: string;
  progress: Map<string, AcProgress>;
  loading: boolean;
  error: string | undefined;
  selectedPath: string | undefined;
  onRefresh: () => void;
  onOpen: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
  advancingIds?: ReadonlySet<string>;
  onAdvance?: (id: string, status: TaskStatus) => void;
  collapsedStatuses?: ReadonlySet<TaskStatus>;
  onToggleStatus?: (status: TaskStatus) => void;
}

const NO_COLLAPSED: ReadonlySet<TaskStatus> = new Set<TaskStatus>();

function groupByStatus(tasks: Task[]): Map<TaskStatus, Task[]> {
  const columns = new Map<TaskStatus, Task[]>(TASK_STATUSES.map((s) => [s, []]));
  for (const task of tasks) {
    columns.get(task.status)?.push(task);
  }
  return columns;
}

export function TaskBoardView({
  tasks,
  query = "",
  progress,
  loading,
  error,
  selectedPath,
  onRefresh,
  onOpen,
  onOpenInNewTab,
  onOpenInOtherPane,
  advancingIds,
  onAdvance,
  collapsedStatuses = NO_COLLAPSED,
  onToggleStatus,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const { filter, setLabels } = useTaskFilter();

  const labels = useMemo(() => availableLabels(tasks), [tasks]);
  useEffect(() => setLabels(labels), [labels, setLabels]);
  const activeFilter = useMemo<TaskFilter>(() => ({ ...filter, text: query }), [filter, query]);
  const filtered = useMemo(() => filterTasks(tasks, activeFilter), [tasks, activeFilter]);
  const columns = groupByStatus(filtered);
  const searching = isFilterActive(activeFilter);

  const handleDrop = (status: TaskStatus) => {
    if (draggingId && onAdvance) onAdvance(draggingId, status);
    setDraggingId(null);
  };

  // A collapsed group that holds matches reveals itself while a query or filter
  // is active, so search results are never hidden behind the reader's choice.
  const isCollapsed = (status: TaskStatus, count: number) =>
    collapsedStatuses.has(status) && !(searching && count > 0);

  return (
    <div className="flex flex-col gap-3 px-2 py-2" data-slot="tasks-board">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {filtered.length}
          {searching && ` / ${tasks.length}`} task
          {tasks.length === 1 ? "" : "s"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-6 text-muted-foreground"
          onClick={onRefresh}
          title="Refresh tasks"
        >
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {error && <p className="px-1 text-xs text-destructive">{error}</p>}

      {loading && tasks.length === 0 ? (
        <BoardSkeleton />
      ) : filtered.length === 0 ? (
        <Empty className="py-8">
          <EmptyHeader>
            <EmptyTitle>{searching ? "No matching tasks" : "No tasks"}</EmptyTitle>
            <EmptyDescription>
              {searching
                ? "Adjust the search or filters in the sidebar header."
                : "Agents create tasks in tasks/ via MCP."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        TASK_STATUSES.map((status) => {
          const columnTasks = columns.get(status) ?? [];
          return (
            <TaskColumn
              key={status}
              status={status}
              tasks={columnTasks}
              collapsed={isCollapsed(status, columnTasks.length)}
              onToggle={() => onToggleStatus?.(status)}
              progress={progress}
              selectedPath={selectedPath}
              onOpen={onOpen}
              onOpenInNewTab={onOpenInNewTab}
              onOpenInOtherPane={onOpenInOtherPane}
              advancingIds={advancingIds}
              draggable={!!onAdvance}
              isDropTarget={draggingId !== null}
              onDragStartTask={setDraggingId}
              onDragEndTask={() => setDraggingId(null)}
              onDropTask={handleDrop}
            />
          );
        })
      )}
    </div>
  );
}

interface ColumnProps {
  status: TaskStatus;
  tasks: Task[];
  collapsed: boolean;
  onToggle: () => void;
  progress: Map<string, AcProgress>;
  selectedPath: string | undefined;
  onOpen: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
  advancingIds?: ReadonlySet<string>;
  draggable: boolean;
  isDropTarget: boolean;
  onDragStartTask: (id: string) => void;
  onDragEndTask: () => void;
  onDropTask: (status: TaskStatus) => void;
}

function TaskColumn({
  status,
  tasks,
  collapsed,
  onToggle,
  progress,
  selectedPath,
  onOpen,
  onOpenInNewTab,
  onOpenInOtherPane,
  advancingIds,
  draggable,
  isDropTarget,
  onDragStartTask,
  onDragEndTask,
  onDropTask,
}: ColumnProps) {
  const listId = useId();
  return (
    <section
      data-status={status}
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "flex flex-col gap-1.5",
        isDropTarget && "rounded-md outline-dashed outline-1 outline-border"
      )}
      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
      onDrop={
        draggable
          ? (e) => {
              e.preventDefault();
              onDropTask(status);
            }
          : undefined
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={listId}
        aria-label={`${status}, ${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
        className="flex items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ChevronRight
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            !collapsed && "rotate-90"
          )}
        />
        <Badge className={cn("border-transparent", STATUS_STYLES[status])}>{status}</Badge>
        <span className="tabular-nums text-xs text-muted-foreground">{tasks.length}</span>
      </button>
      {!collapsed && tasks.length > 0 && (
        <ul id={listId} className="flex flex-col gap-1.5">
          {tasks.map((task) => (
            <li key={task.path}>
              <TaskCard
                task={task}
                progress={progress.get(task.path)}
                selected={task.path === selectedPath}
                onOpen={onOpen}
                onOpenInNewTab={onOpenInNewTab}
                onOpenInOtherPane={onOpenInOtherPane}
                draggable={draggable}
                advancing={advancingIds?.has(task.id) ?? false}
                onDragStart={() => onDragStartTask(task.id)}
                onDragEnd={onDragEndTask}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-1">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
