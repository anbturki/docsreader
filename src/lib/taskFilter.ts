import { TASK_STATUSES, type Task, type TaskPriority, type TaskStatus } from "./tasks";

export interface TaskFilter {
  text: string;
  label: string | null;
  priority: TaskPriority | null;
}

export const EMPTY_TASK_FILTER: TaskFilter = { text: "", label: null, priority: null };

export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  const text = filter.text.trim().toLowerCase();
  return tasks.filter((task) => {
    if (text && !`${task.title ?? ""} ${task.id}`.toLowerCase().includes(text)) return false;
    if (filter.label && !task.labels.includes(filter.label)) return false;
    if (filter.priority && task.priority !== filter.priority) return false;
    return true;
  });
}

export function availableLabels(tasks: Task[]): string[] {
  const labels = new Set<string>();
  for (const task of tasks) for (const label of task.labels) labels.add(label);
  return [...labels].sort();
}

export function isFilterActive(filter: TaskFilter): boolean {
  return filter.text.trim() !== "" || filter.label !== null || filter.priority !== null;
}

export function groupTasksByStatus(tasks: Task[]): Map<TaskStatus, Task[]> {
  const columns = new Map<TaskStatus, Task[]>(TASK_STATUSES.map((s) => [s, []]));
  for (const task of tasks) columns.get(task.status)?.push(task);
  return columns;
}

export function taskCountLabel(shown: number, total: number): string {
  const tally = shown === total ? `${total}` : `${shown} / ${total}`;
  return `${tally} task${total === 1 ? "" : "s"}`;
}
