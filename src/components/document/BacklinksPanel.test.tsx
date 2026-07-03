import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";
import type { MarkdownFile } from "@/lib/scan";
import { BacklinksPanel } from "./BacklinksPanel";

function file(relPath: string, overrides: Partial<MarkdownFile> = {}): MarkdownFile {
  return {
    path: `/ws/${relPath}`,
    name: relPath.split("/").pop() ?? relPath,
    relPath,
    tags: [],
    size: 1,
    ...overrides,
  };
}

const FILES: MarkdownFile[] = [
  file("target.md", { title: "Target" }),
  file("intro.md", { title: "Intro", links: ["target.md"] }),
  file("guides/setup.md", { title: "Setup guide", links: ["target.md", "intro.md"] }),
  file("guides/unrelated.md", { links: ["intro.md"] }),
];

describe("BacklinksPanel", () => {
  it("lists linking docs grouped by source folder", () => {
    render(
      <BacklinksPanel files={FILES} activePath="/ws/target.md" onNavigate={vi.fn()} />
    );
    expect(screen.getByText("Backlinks")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
    expect(screen.getByText("guides")).toBeInTheDocument();
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("Setup guide")).toBeInTheDocument();
    expect(screen.queryByText("unrelated.md")).not.toBeInTheDocument();
  });

  it("navigates to the linking doc on click", async () => {
    const onNavigate = vi.fn();
    render(
      <BacklinksPanel files={FILES} activePath="/ws/target.md" onNavigate={onNavigate} />
    );
    await userEvent.click(screen.getByText("Setup guide"));
    expect(onNavigate).toHaveBeenCalledWith("/ws/guides/setup.md");
  });

  it("renders nothing when no doc links here", () => {
    const { container } = render(
      <BacklinksPanel
        files={FILES}
        activePath="/ws/guides/unrelated.md"
        onNavigate={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
