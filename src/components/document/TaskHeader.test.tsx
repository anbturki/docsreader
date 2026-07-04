import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { TaskHeader } from "./TaskHeader";

const TASK_BODY = [
  "## Acceptance Criteria",
  "<!-- AC:BEGIN -->",
  "- [x] #1 first",
  "- [x] #2 second",
  "- [ ] #3 third",
  "<!-- AC:END -->",
].join("\n");

describe("Smoke B3: TaskHeader renders for a real task doc", () => {
  it("shows status pill, priority, assignee, and AC progress", () => {
    const { container } = render(
      <TaskHeader
        meta={{
          id: "task-14",
          status: "In Progress",
          priority: "high",
          assignee: ["claude-code"],
        }}
        relPath="tasks/task-14 - Header.md"
        content={TASK_BODY}
      />
    );

    expect(container.querySelector('[data-slot="task-header"]')).not.toBeNull();
    expect(screen.getByText("In Progress")).toBeTruthy();
    expect(screen.getByText("high priority")).toBeTruthy();
    expect(screen.getByText("claude-code")).toBeTruthy();
    expect(screen.getByText("2/3")).toBeTruthy();
  });

  it("renders nothing for a normal (non-task) doc", () => {
    const { container } = render(
      <TaskHeader
        meta={{ status: "research", title: "Some idea" }}
        relPath="research/idea.md"
        content="just prose, no task"
      />
    );
    expect(container.querySelector('[data-slot="task-header"]')).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("omits the progress bar when the task has no AC block", () => {
    render(
      <TaskHeader
        meta={{ id: "task-1", status: "To Do" }}
        relPath="tasks/task-1.md"
        content="No acceptance criteria here."
      />
    );
    expect(screen.getByText("To Do")).toBeTruthy();
    expect(screen.queryByText(/\d+\/\d+/)).toBeNull();
  });
});
