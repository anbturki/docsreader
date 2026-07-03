import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { FileTree } from "./FileTree";
import { buildTree } from "@/lib/tree";
import type { MarkdownFile } from "@/lib/scan";
import type { GitFileStatusKind } from "@/lib/git";

vi.mock("@tauri-apps/plugin-opener", () => ({ revealItemInDir: vi.fn() }));

const FILES: MarkdownFile[] = [
  {
    path: "/ws/notes/alpha.md",
    name: "alpha.md",
    relPath: "notes/alpha.md",
    tags: [],
    size: 10,
  },
  { path: "/ws/beta.md", name: "beta.md", relPath: "beta.md", tags: [], size: 5 },
];

const handlers = {
  onSelect: vi.fn(),
  onOpenInNewTab: vi.fn(),
  onToggleExpanded: vi.fn(),
  onTogglePin: vi.fn(),
  onHide: vi.fn(),
};

function renderTree(gitStatusByPath?: Map<string, GitFileStatusKind>) {
  return render(
    <FileTree
      node={buildTree("/ws", FILES)}
      rootKey="root"
      onSelect={handlers.onSelect}
      onOpenInNewTab={handlers.onOpenInNewTab}
      isExpanded={() => true}
      onToggleExpanded={handlers.onToggleExpanded}
      isPinned={() => false}
      onTogglePin={handlers.onTogglePin}
      onHide={handlers.onHide}
      gitStatusByPath={gitStatusByPath}
    />
  );
}

beforeEach(() => {
  Object.values(handlers).forEach((h) => h.mockReset());
});

describe("FileTree", () => {
  it("renders folders and files and selects on click", async () => {
    renderTree();
    expect(screen.getByText("notes")).toBeInTheDocument();
    expect(screen.getByText("alpha")).toBeInTheDocument();
    await userEvent.click(screen.getByText("beta"));
    expect(handlers.onSelect).toHaveBeenCalledWith("/ws/beta.md");
    expect(handlers.onOpenInNewTab).not.toHaveBeenCalled();
  });

  it("meta-click opens in a new tab instead of selecting", async () => {
    renderTree();
    const user = userEvent.setup();
    await user.keyboard("{Meta>}");
    await user.click(screen.getByText("alpha"));
    await user.keyboard("{/Meta}");
    expect(handlers.onOpenInNewTab).toHaveBeenCalledWith("/ws/notes/alpha.md");
    expect(handlers.onSelect).not.toHaveBeenCalled();
  });

  it("collapsing a folder reports its key", async () => {
    renderTree();
    await userEvent.click(screen.getByText("notes"));
    expect(handlers.onToggleExpanded).toHaveBeenCalledWith("root::notes", true);
  });

  it("shows a git badge for modified files", () => {
    renderTree(new Map([["beta.md", "modified"]]));
    expect(screen.getByTitle("Modified since HEAD")).toHaveTextContent("M");
  });
});
