import { describe, it, expect } from "vitest";
import { describeReadFailure } from "./useTabs";

describe("describeReadFailure", () => {
  it("replaces the filesystem message for a file that is gone", () => {
    const raw =
      "failed to open file at path: /ws/notes/gone.md with error: No such file or directory (os error 2)";

    const shown = describeReadFailure(new Error(raw));

    expect(shown).not.toContain("os error");
    expect(shown).not.toContain("/ws/notes/gone.md");
    expect(shown.toLowerCase()).toContain("no longer on disk");
  });

  it("keeps a message it does not recognise, so nothing is swallowed", () => {
    const shown = describeReadFailure(new Error("permission denied (os error 13)"));

    expect(shown).toBe("permission denied (os error 13)");
  });
});
