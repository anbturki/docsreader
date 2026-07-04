import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
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
  EMPTY_TASK_FILTER,
  type TaskFilter,
} from "@/lib/taskFilter";
import { STATUS_STYLES } from "@/lib/taskStyles";
import { TaskBoardFilters } from "./TaskBoardFilters";
import { TaskCard } from "./TaskCard";

interface Props {
  tasks: Task[];
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
}

function groupByStatus(tasks: Task[]): Map<TaskStatus, Task[]> {
  const columns = new Map<TaskStatus, Task[]>(TASK_STATUSES.map((s) => [s, []]));
  for (const task of tasks) {
    columns.get(task.status)?.push(task);
  }
  return columns;
}

export function TaskBoardView({
  tasks,
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
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>(EMPTY_TASK_FILTER);

  const labels = useMemo(() => availableLabels(tasks), [tasks]);
  const filtered = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);
  const columns = groupByStatus(filtered);
  const hasTasks = tasks.length > 0;

  const handleDrop = (status: TaskStatus) => {
    if (draggingId && onAdvance) onAdvance(draggingId, status);
    setDraggingId(null);
  };

  return (
    <div className="flex flex-col gap-3 px-2 py-2" data-slot="tasks-board">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {filtered.length}
          {isFilterActive(filter) && ` / ${tasks.length}`} task
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

      {hasTasks && !loading && (
        <TaskBoardFilters filter={filter} labels={labels} onChange={setFilter} />
      )}

      {error && <p className="px-1 text-xs text-destructive">{error}</p>}

      {loading && tasks.length === 0 ? (
        <BoardSkeleton />
      ) : filtered.length === 0 ? (
        <Empty className="py-8">
          <EmptyHeader>
            <EmptyTitle>{isFilterActive(filter) ? "No matching tasks" : "No tasks"}</EmptyTitle>
            <EmptyDescription>
              {isFilterActive(filter)
                ? "Adjust or clear the filters above."
                : "Agents create tasks in tasks/ via MCP."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        TASK_STATUSES.map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={columns.get(status) ?? []}
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
        ))
      )}
    </div>
  );
}

interface ColumnProps {
  status: TaskStatus;
  tasks: Task[];
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
  return (
    <section
      data-status={status}
      className={cn(
        "flex flex-col gap-1.5",
        isDropTarget && "outline-dashed outline-1 outline-border"
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
      <div className="flex items-center gap-2 px-1">
        <Badge className={cn("border-transparent", STATUS_STYLES[status])}>{status}</Badge>
        <span className="tabular-nums text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      {tasks.length > 0 && (
        <ul className="flex flex-col gap-1.5">
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
