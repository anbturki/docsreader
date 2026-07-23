import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/lib/tasks";
import type { AcProgress } from "@/lib/taskDoc";
import { PRIORITY_STYLES } from "@/lib/taskStyles";
import { EntryContextMenu } from "@/components/explorer/EntryContextMenu";
import { fileOpenHandlers, sidebarRowState } from "@/components/explorer/sidebarRow";
import { TASK_LIST_COLUMNS } from "./taskListColumns";

interface Props {
  task: Task;
  progress: AcProgress | undefined;
  selected: boolean;
  advancing: boolean;
  onOpen: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
}

export function TaskListRow({
  task,
  progress,
  selected,
  advancing,
  onOpen,
  onOpenInNewTab,
  onOpenInOtherPane,
}: Props) {
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
        data-slot="task-row"
        className={cn(
          TASK_LIST_COLUMNS,
          "w-full py-1 text-left text-xs transition-colors",
          sidebarRowState(selected),
          advancing && "pointer-events-none opacity-50"
        )}
      >
        <span className="truncate">{task.title || task.id}</span>
        <LabelsCell labels={task.labels} />
        <span className="truncate text-xs text-muted-foreground">{assignee}</span>
        <span className="truncate text-xs">
          {task.priority && (
            <span className={cn("flex items-center gap-1", PRIORITY_STYLES[task.priority])}>
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
              <span className="truncate">{task.priority}</span>
            </span>
          )}
        </span>
        <span className="truncate text-xs tabular-nums text-muted-foreground">
          {hasProgress && `${progress.done}/${progress.total}`}
        </span>
      </button>
    </EntryContextMenu>
  );
}

function LabelsCell({ labels }: { labels: string[] }) {
  return (
    <span className="flex min-w-0 items-center gap-1 overflow-hidden">
      {labels.map((label) => (
        <Badge
          key={label}
          variant="secondary"
          className="max-w-full shrink-0 truncate border-transparent px-1 py-0 text-[10px] font-normal"
        >
          {label}
        </Badge>
      ))}
    </span>
  );
}
