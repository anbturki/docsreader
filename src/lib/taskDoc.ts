import { TASK_STATUSES, type TaskStatus } from "./tasks";

const STATUS_SET: ReadonlySet<string> = new Set(TASK_STATUSES);
const TASK_ID = /^task-\d+$/;
const TASKS_DIR = /(^|[/\\])tasks[/\\]/;

// Task bodies delimit acceptance criteria with these HTML comments; only
// checkbox items inside the block count toward progress.
const AC_BLOCK = /<!--\s*AC:BEGIN\s*-->([\s\S]*?)<!--\s*AC:END\s*-->/;
const AC_ITEM = /^[ \t]*[-*] \[([ xX])\]/gm;

export interface AcProgress {
  done: number;
  total: number;
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && STATUS_SET.has(value);
}

// A doc is a task when its frontmatter status is a task status AND it is
// identified as a task by id (task-N) or by living under a tasks/ folder.
// Recognition never inspects the body, so a doc that merely mentions a
// status in prose is not mistaken for a task.
export function isTask(
  frontmatter: Record<string, unknown>,
  relPath: string
): boolean {
  if (!isTaskStatus(frontmatter.status)) return false;
  const id = frontmatter.id;
  const idIsTask = typeof id === "string" && TASK_ID.test(id);
  return idIsTask || TASKS_DIR.test(relPath);
}

export function parseAcProgress(content: string): AcProgress {
  const block = AC_BLOCK.exec(content);
  if (!block) return { done: 0, total: 0 };
  let done = 0;
  let total = 0;
  for (const item of block[1].matchAll(AC_ITEM)) {
    total += 1;
    if (item[1] !== " ") done += 1;
  }
  return { done, total };
}
