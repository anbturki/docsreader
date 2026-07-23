import { useId } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Task, TaskStatus } from "@/lib/tasks";
import type { AcProgress } from "@/lib/taskDoc";
import { STATUS_STYLES } from "@/lib/taskStyles";
import { TaskListColumnHeader } from "./TaskListColumnHeader";
import { TaskListRow } from "./TaskListRow";

interface Props {
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
}

export function TaskListGroup({
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
}: Props) {
  const listId = useId();

  return (
    <section data-task-group={status} className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={listId}
        aria-label={groupLabel(status, tasks.length)}
        className="flex items-center gap-2 px-3 py-1 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
      {!collapsed && (
        <div id={listId}>
          <TaskListColumnHeader />
          <ul className="flex flex-col divide-y divide-border/70">
            {tasks.map((task) => (
              <li key={task.path}>
                <TaskListRow
                  task={task}
                  progress={progress.get(task.path)}
                  selected={task.path === selectedPath}
                  advancing={advancingIds?.has(task.id) ?? false}
                  onOpen={onOpen}
                  onOpenInNewTab={onOpenInNewTab}
                  onOpenInOtherPane={onOpenInOtherPane}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function groupLabel(status: TaskStatus, count: number): string {
  return `${status}, ${count} task${count === 1 ? "" : "s"}`;
}
