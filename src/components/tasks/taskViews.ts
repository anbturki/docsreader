import type { ComponentType } from "react";
import { Columns3, List, type LucideIcon } from "lucide-react";

import type { TaskTabView } from "@/lib/storage";
import { TaskBoardView } from "./TaskBoardView";
import { TaskListView } from "./TaskListView";
import type { TaskViewProps } from "./taskViewProps";

export interface TaskViewDef {
  label: string;
  icon: LucideIcon;
  component: ComponentType<TaskViewProps>;
}

export const TASK_VIEWS: Record<TaskTabView, TaskViewDef> = {
  list: { label: "List", icon: List, component: TaskListView },
  board: { label: "Board", icon: Columns3, component: TaskBoardView },
};
