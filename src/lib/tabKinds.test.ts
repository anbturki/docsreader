import { describe, it, expect } from "vitest";

import { explorerOpen, TAB_KINDS, TAB_KIND_SPECS, TASKS_TARGET, fileTarget } from "./tabKinds";

describe("what each tab kind wants beside it", () => {
  it("keeps the explorer beside a document", () => {
    expect(TAB_KIND_SPECS[fileTarget("/ws/a.md").kind].wantsExplorer).toBe(true);
  });

  // The board already lists the workspace, so the explorer beside it would
  // repeat itself in the width the columns need.
  it("drops the explorer beside a tab that is itself a view of the workspace", () => {
    expect(TAB_KIND_SPECS[TASKS_TARGET.kind].wantsExplorer).toBe(false);
  });

  it("makes every kind answer, so a new one cannot forget to", () => {
    for (const kind of TAB_KINDS) {
      expect(typeof TAB_KIND_SPECS[kind].wantsExplorer).toBe("boolean");
    }
  });
});

describe("whether the explorer shows beside a tab", () => {
  it("uses the remembered preference beside a document", () => {
    expect(explorerOpen("file", true, false)).toBe(true);
    expect(explorerOpen("file", false, true)).toBe(false);
  });

  it("ignores the remembered preference beside a workspace view", () => {
    expect(explorerOpen("tasks", true, false)).toBe(false);
  });

  it("still shows it there when it has been asked for", () => {
    expect(explorerOpen("tasks", false, true)).toBe(true);
  });

  it("falls back to the preference when no tab is open", () => {
    expect(explorerOpen(undefined, true, false)).toBe(true);
  });
});
