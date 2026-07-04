import { describe, it, expect } from "vitest";

import { isTask, parseAcProgress } from "./taskDoc";

describe("isTask", () => {
  it("recognizes a task file by status + task-N id", () => {
    expect(isTask({ status: "In Progress", id: "task-14" }, "tasks/task-14.md")).toBe(true);
  });

  it("recognizes a task by status + tasks/ path even without a task-N id", () => {
    expect(isTask({ status: "To Do" }, "tasks/notes.md")).toBe(true);
    expect(isTask({ status: "Done" }, "sub\\tasks\\a.md")).toBe(true);
  });

  it("rejects ordinary docs whose status is a folder status", () => {
    expect(isTask({ status: "research" }, "research/idea.md")).toBe(false);
    expect(isTask({ status: "in-progress" }, "in-progress/spec.md")).toBe(false);
    expect(isTask({}, "done/report.md")).toBe(false);
  });

  it("does not treat a task-N id alone as a task without a task status", () => {
    expect(isTask({ id: "task-1" }, "docs/task-1.md")).toBe(false);
  });

  it("does not false-positive on a body mention (frontmatter only)", () => {
    expect(isTask({ status: "research" }, "research/how-tasks-work.md")).toBe(false);
  });
});

describe("Smoke B1: recognition true/false fixtures", () => {
  const cases: Array<{ name: string; fm: Record<string, unknown>; rel: string; want: boolean }> = [
    { name: "real task file", fm: { status: "In Progress", id: "task-14" }, rel: "tasks/task-14 - Header.md", want: true },
    { name: "doc under tasks/ without a task status", fm: { status: "research" }, rel: "tasks/scratch.md", want: false },
    { name: "normal research doc", fm: { status: "research" }, rel: "research/plan.md", want: false },
    { name: "malformed id task- (no number)", fm: { status: "To Do", id: "task-" }, rel: "elsewhere/x.md", want: false },
    { name: "malformed id but under tasks/", fm: { status: "To Do", id: "task-" }, rel: "tasks/x.md", want: true },
    { name: "missing status", fm: { id: "task-3" }, rel: "tasks/task-3.md", want: false },
    { name: "non-string status", fm: { status: 3 }, rel: "tasks/task-3.md", want: false },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(isTask(c.fm, c.rel)).toBe(c.want);
    });
  }
});

describe("parseAcProgress", () => {
  it("counts only items inside the AC block", () => {
    const body = [
      "## Acceptance Criteria",
      "<!-- AC:BEGIN -->",
      "- [x] #1 done",
      "- [ ] #2 todo",
      "- [X] #3 done upper",
      "<!-- AC:END -->",
    ].join("\n");
    expect(parseAcProgress(body)).toEqual({ done: 2, total: 3 });
  });

  it("returns 0/0 when there is no AC block", () => {
    expect(parseAcProgress("just a doc\n- [x] a stray box")).toEqual({ done: 0, total: 0 });
  });

  it("ignores checkboxes outside the AC block", () => {
    const body = [
      "- [x] outside before",
      "<!-- AC:BEGIN -->",
      "- [ ] #1 inside",
      "<!-- AC:END -->",
      "- [x] outside after",
    ].join("\n");
    expect(parseAcProgress(body)).toEqual({ done: 0, total: 1 });
  });
});

describe("Smoke B2: AC-progress counting", () => {
  const wrap = (items: string[]) => `<!-- AC:BEGIN -->\n${items.join("\n")}\n<!-- AC:END -->`;

  it("all unchecked", () => {
    expect(parseAcProgress(wrap(["- [ ] a", "- [ ] b"]))).toEqual({ done: 0, total: 2 });
  });

  it("mixed", () => {
    expect(parseAcProgress(wrap(["- [x] a", "- [ ] b", "- [x] c"]))).toEqual({ done: 2, total: 3 });
  });

  it("all checked", () => {
    expect(parseAcProgress(wrap(["- [x] a", "- [x] b"]))).toEqual({ done: 2, total: 2 });
  });

  it("no block", () => {
    expect(parseAcProgress("# title\nno criteria here")).toEqual({ done: 0, total: 0 });
  });

  it("stray checkboxes outside the block are not counted", () => {
    const body = `- [x] stray\n${wrap(["- [x] a", "- [ ] b"])}\n- [ ] another stray`;
    expect(parseAcProgress(body)).toEqual({ done: 1, total: 2 });
  });
});
