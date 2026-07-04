// Mirror of src-tauri/core/src/tasks.rs: the TASK_STATUSES / TASK_PRIORITIES
// closed sets and the TaskSummary struct (serialized camelCase). Keep in
// lockstep with the Rust source of truth; tasks.test.ts asserts the arrays match.
export const TASK_STATUSES = ["To Do", "In Progress", "Done"] as const;
export const TASK_PRIORITIES = ["high", "medium", "low"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  title: string | null;
  status: TaskStatus;
  assignee: string[];
  labels: string[];
  dependencies: string[];
  priority: TaskPriority | null;
  createdDate: string | null;
  updatedDate: string | null;
  relPath: string;
  path: string;
}
