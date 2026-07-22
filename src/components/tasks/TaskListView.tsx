import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/lib/tasks";
import type { AcProgress } from "@/lib/taskDoc";
import { PRIORITY_STYLES, STATUS_STYLES } from "@/lib/taskStyles";
import { EntryContextMenu } from "@/components/explorer/EntryContextMenu";
import { SIDEBAR_ROW, fileOpenHandlers, sidebarRowState } from "@/components/explorer/sidebarRow";
import type { TaskViewProps } from "./taskViews";

export function TaskListView({
  tasks,
  progress,
  selectedPath,
  onOpen,
  onOpenInNewTab,
  onOpenInOtherPane,
  advancingIds,
}: TaskViewProps) {
  return (
    <ul className="flex flex-col py-1" data-slot="tasks-list">
      {tasks.map((task) => (
        <li key={task.path}>
          <TaskRow
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
  );
}

interface RowProps {
  task: Task;
  progress: AcProgress | undefined;
  selected: boolean;
  advancing: boolean;
  onOpen: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
}

function TaskRow({
  task,
  progress,
  selected,
  advancing,
  onOpen,
  onOpenInNewTab,
  onOpenInOtherPane,
}: RowProps) {
  const assignee = task.assignee.join(", ");
  const hasProgress = !!progress && progress.total > 0;

  return (
    <EntryContextMenu
      path={task.path}
      isFile
      onOpenInNewTab={onOpenInNewTab}
      onOpenInOtherPane={onOpenInOtherPane}
    >
      <button
        {...fileOpenHandlers(task.path, onOpen, onOpenInNewTab)}
        title={task.relPath}
        className={cn(
          SIDEBAR_ROW,
          "flex-col items-start gap-0.5 px-3",
          sidebarRowState(selected),
          advancing && "pointer-events-none opacity-50"
        )}
      >
        <span className="w-full truncate">{task.title || task.id}</span>
        <span className="flex w-full items-center gap-1.5 text-[11px] text-muted-foreground">
          <Badge
            className={cn("border-transparent px-1 py-0 text-[10px]", STATUS_STYLES[task.status])}
          >
            {task.status}
          </Badge>
          {task.priority && (
            <span className={cn("flex items-center gap-1", PRIORITY_STYLES[task.priority])}>
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {task.priority}
            </span>
          )}
          {assignee && <span className="truncate">{assignee}</span>}
          {hasProgress && (
            <span className="ml-auto shrink-0 tabular-nums">
              {progress.done}/{progress.total}
            </span>
          )}
        </span>
      </button>
    </EntryContextMenu>
  );
}
