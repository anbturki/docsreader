import type { Task, TaskStatus } from "@/lib/tasks";
import type { AcProgress } from "@/lib/taskDoc";

// The one shape every rendering of a task set is handed, whether it is a view
// the tab offers or the sidebar's own drawing.
export interface TaskViewProps {
  /** Already narrowed by the shared query and the header filters. */
  tasks: Task[];
  searching: boolean;
  progress: Map<string, AcProgress>;
  selectedPath: string | undefined;
  onOpen: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
  advancingIds?: ReadonlySet<string>;
  onAdvance?: (id: string, status: TaskStatus) => void;
  collapsedStatuses?: ReadonlySet<TaskStatus>;
  onToggleStatus?: (status: TaskStatus) => void;
}
