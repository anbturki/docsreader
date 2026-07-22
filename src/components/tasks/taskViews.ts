import type { ComponentType } from "react";
import { Columns3, List, type LucideIcon } from "lucide-react";

import type { Task, TaskStatus } from "@/lib/tasks";
import type { AcProgress } from "@/lib/taskDoc";
import type { LensViewId } from "@/lib/storage";
import { TaskBoardView } from "./TaskBoardView";
import { TaskListView } from "./TaskListView";

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

export interface TaskViewDef {
  label: string;
  icon: LucideIcon;
  component: ComponentType<TaskViewProps>;
}

export const TASK_VIEWS: Record<LensViewId, TaskViewDef> = {
  board: { label: "Board", icon: Columns3, component: TaskBoardView },
  list: { label: "List", icon: List, component: TaskListView },
};
