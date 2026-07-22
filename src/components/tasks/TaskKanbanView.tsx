import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/lib/tasks";
import { groupTasksByStatus } from "@/lib/taskFilter";
import type { AcProgress } from "@/lib/taskDoc";
import { STATUS_STYLES } from "@/lib/taskStyles";
import type { TaskViewProps } from "./taskViews";
import { TaskCard } from "./TaskCard";

export function TaskKanbanView({
  tasks,
  progress,
  selectedPath,
  onOpen,
  onOpenInNewTab,
  onOpenInOtherPane,
  advancingIds,
  onAdvance,
}: TaskViewProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const columns = groupTasksByStatus(tasks);

  const handleDrop = (status: TaskStatus) => {
    if (draggingId && onAdvance) onAdvance(draggingId, status);
    setDraggingId(null);
  };

  return (
    // Columns scroll sideways inside this box, so a board wider than the
    // window never becomes a horizontal scrollbar on the page itself.
    <div className="min-h-0 flex-1 overflow-x-auto p-3" data-slot="tasks-kanban">
      <div className="flex h-full min-h-0 gap-3">
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
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
        ))}
      </div>
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

function KanbanColumn({
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
      aria-label={`${status}, ${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
      className={cn(
        "flex h-full min-h-0 w-72 shrink-0 flex-col rounded-lg border bg-muted/40",
        isDropTarget && "border-dashed border-ring/60"
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
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <Badge className={cn("border-transparent", STATUS_STYLES[status])}>{status}</Badge>
        <span className="tabular-nums text-xs text-muted-foreground">{tasks.length}</span>
      </header>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
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
    </section>
  );
}
