import { TASK_STATUSES, type TaskStatus } from "@/lib/tasks";
import { groupTasksByStatus } from "@/lib/taskFilter";
import type { TaskViewProps } from "./taskViewProps";
import { TaskListGroup } from "./TaskListGroup";

const NO_COLLAPSED: ReadonlySet<TaskStatus> = new Set<TaskStatus>();

export function TaskListView({
  tasks,
  searching,
  progress,
  selectedPath,
  onOpen,
  onOpenInNewTab,
  onOpenInOtherPane,
  advancingIds,
  collapsedStatuses = NO_COLLAPSED,
  onToggleStatus,
}: TaskViewProps) {
  const groups = groupTasksByStatus(tasks);

  // A folded group that holds matches reveals itself while a query or filter is
  // active, so search results are never hidden behind the reader's choice.
  const isFolded = (status: TaskStatus, count: number) =>
    collapsedStatuses.has(status) && !(searching && count > 0);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col divide-y divide-border/60 overflow-auto py-1"
      data-slot="tasks-list"
    >
      {TASK_STATUSES.map((status) => {
        const groupTasks = groups.get(status) ?? [];
        if (groupTasks.length === 0) return null;
        return (
          <TaskListGroup
            key={status}
            status={status}
            tasks={groupTasks}
            collapsed={isFolded(status, groupTasks.length)}
            onToggle={() => onToggleStatus?.(status)}
            progress={progress}
            selectedPath={selectedPath}
            onOpen={onOpen}
            onOpenInNewTab={onOpenInNewTab}
            onOpenInOtherPane={onOpenInOtherPane}
            advancingIds={advancingIds}
          />
        );
      })}
    </div>
  );
}
