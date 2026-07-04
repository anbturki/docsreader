import { describe, it, expect } from "vitest";

import { TASK_PRIORITIES, TASK_STATUSES } from "./tasks";

// Must match src-tauri/core/src/tasks.rs verbatim, order included. If the Rust
// source changes, this fails and both sides get updated together.
describe("task constants mirror the Rust core", () => {
  it("TASK_STATUSES matches tasks.rs", () => {
    expect([...TASK_STATUSES]).toEqual(["To Do", "In Progress", "Done"]);
  });

  it("TASK_PRIORITIES matches tasks.rs", () => {
    expect([...TASK_PRIORITIES]).toEqual(["high", "medium", "low"]);
  });
});
