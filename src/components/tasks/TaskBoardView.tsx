import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/lib/tasks";
import type { AcProgress } from "@/lib/taskDoc";
import { STATUS_STYLES } from "@/lib/taskStyles";
import type { TaskViewProps } from "./taskViews";
import { TaskCard } from "./TaskCard";

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
  searching,
  progress,
  selectedPath,
  onOpen,
  onOpenInNewTab,
  onOpenInOtherPane,
  advancingIds,
  onAdvance,
  collapsedStatuses = NO_COLLAPSED,
  onToggleStatus,
}: TaskViewProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const columns = groupByStatus(tasks);

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
      {TASK_STATUSES.map((status) => {
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
      })}
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
