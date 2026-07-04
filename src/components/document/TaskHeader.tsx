import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { isTask, isTaskStatus, parseAcProgress } from "@/lib/taskDoc";
import { STATUS_STYLES, PRIORITY_STYLES, PROGRESS_FILL } from "@/lib/taskStyles";
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/tasks";

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function toPriority(value: unknown): TaskPriority | null {
  return typeof value === "string" && (TASK_PRIORITIES as readonly string[]).includes(value)
    ? (value as TaskPriority)
    : null;
}

interface Props {
  meta: Record<string, unknown>;
  relPath: string;
  content: string;
}

export function TaskHeader({ meta, relPath, content }: Props) {
  if (!isTask(meta, relPath) || !isTaskStatus(meta.status)) return null;

  const status = meta.status;
  const priority = toPriority(meta.priority);
  const assignees = toStringList(meta.assignee);
  const progress = parseAcProgress(content);
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" data-slot="task-header">
      <Badge className={cn("border-transparent", STATUS_STYLES[status])}>{status}</Badge>
      {priority && (
        <Badge variant="outline" className={PRIORITY_STYLES[priority]}>
          {priority} priority
        </Badge>
      )}
      {assignees.length > 0 && (
        <span className="text-muted-foreground">{assignees.join(", ")}</span>
      )}
      {progress.total > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", PROGRESS_FILL)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="tabular-nums text-muted-foreground">
            {progress.done}/{progress.total}
          </span>
        </div>
      )}
    </div>
  );
}
