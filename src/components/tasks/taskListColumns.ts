// The one template the column header and every row lay themselves out with, so
// a column cannot drift between them.
export const TASK_LIST_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_9rem_7rem_5rem_3.5rem] items-center gap-3 px-3";

export const TASK_LIST_HEADINGS = ["Task", "Labels", "Assignee", "Priority", "Criteria"] as const;
