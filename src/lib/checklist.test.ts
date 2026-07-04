import { describe, expect, it } from "vitest";
import { toggleTaskCheckbox } from "./checklist";

describe("toggleTaskCheckbox", () => {
  it("checks an unchecked item and unchecks a checked one", () => {
    const src = "- [ ] a\n- [x] b\n";
    expect(toggleTaskCheckbox(src, 0)).toBe("- [x] a\n- [x] b\n");
    expect(toggleTaskCheckbox(src, 1)).toBe("- [ ] a\n- [ ] b\n");
  });

  it("targets the Nth checkbox in document order", () => {
    const src = "- [ ] a\n- [ ] b\n- [ ] c\n";
    expect(toggleTaskCheckbox(src, 2)).toBe("- [ ] a\n- [ ] b\n- [x] c\n");
  });

  it("preserves frontmatter verbatim and excludes it from the count", () => {
    const src = "---\ntitle: T\nstatus: To Do\n---\n\n- [ ] first\n";
    expect(toggleTaskCheckbox(src, 0)).toBe(
      "---\ntitle: T\nstatus: To Do\n---\n\n- [x] first\n"
    );
  });

  it("skips checkbox-looking lines inside fenced code blocks", () => {
    const src = "```\n- [ ] not real\n```\n\n- [ ] real\n";
    expect(toggleTaskCheckbox(src, 0)).toBe(
      "```\n- [ ] not real\n```\n\n- [x] real\n"
    );
  });

  it("handles *, + and X markers and nesting", () => {
    expect(toggleTaskCheckbox("* [ ] a\n", 0)).toBe("* [x] a\n");
    expect(toggleTaskCheckbox("+ [X] a\n", 0)).toBe("+ [ ] a\n");
    expect(toggleTaskCheckbox("  - [ ] nested\n", 0)).toBe("  - [x] nested\n");
  });

  it("returns null when there is no Nth checkbox", () => {
    expect(toggleTaskCheckbox("- [ ] only\n", 1)).toBeNull();
    expect(toggleTaskCheckbox("no checkboxes here\n", 0)).toBeNull();
  });

  it("only flips the checkbox mark, not other brackets on the line", () => {
    expect(toggleTaskCheckbox("- [ ] see [x] in text\n", 0)).toBe(
      "- [x] see [x] in text\n"
    );
  });
});
