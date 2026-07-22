import { cn } from "@/lib/utils";
import { TASK_LIST_COLUMNS, TASK_LIST_HEADINGS } from "./taskListColumns";

export function TaskListColumnHeader() {
  return (
    <div
      className={cn(
        TASK_LIST_COLUMNS,
        "py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70"
      )}
      data-slot="task-columns"
    >
      {TASK_LIST_HEADINGS.map((heading) => (
        <span key={heading} className="truncate">
          {heading}
        </span>
      ))}
    </div>
  );
}
