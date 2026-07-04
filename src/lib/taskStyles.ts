import type { TaskStatus, TaskPriority } from "./tasks";

// Colors come from the Strata status palette (--status-*), which is
// theme-aware, so light/dark parity is automatic and no color literal is
// duplicated here. To Do -> neutral, In Progress -> info, Done -> success.
export const STATUS_STYLES: Record<TaskStatus, string> = {
  "To Do": "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
  "In Progress": "bg-[var(--status-info-bg)] text-[var(--status-info-fg)]",
  Done: "bg-[var(--status-success-bg)] text-[var(--status-success-fg)]",
};

export const PRIORITY_STYLES: Record<TaskPriority, string> = {
  high: "text-[var(--status-error-fg)]",
  medium: "text-[var(--status-warning-fg)]",
  low: "text-muted-foreground",
};

export const PROGRESS_FILL = "bg-[var(--status-success-fg)]";
