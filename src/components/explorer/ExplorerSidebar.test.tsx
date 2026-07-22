import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeAll } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSidebarSearch } from "@/hooks/useSidebarSearch";
import type { SidebarLens } from "@/lib/storage";
import type { SearchEntry } from "@/lib/searchEntries";
import type { MarkdownFile } from "@/lib/scan";

import { ExplorerSidebar } from "./ExplorerSidebar";

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    get = vi.fn();
    set = vi.fn();
    save = vi.fn();
  },
}));

vi.mock("@tauri-apps/plugin-opener", () => ({ revealItemInDir: vi.fn() }));

const { TASKS } = vi.hoisted(() => {
  const task = (id: string, title: string) => ({
    id,
    title,
    status: "To Do",
    assignee: [],
    labels: [],
    dependencies: [],
    priority: null,
    createdDate: null,
    updatedDate: null,
    relPath: `tasks/${id}.md`,
    path: `/ws/voice/tasks/${id}.md`,
  });
  return { TASKS: [task("task-1", "Wire the relay"), task("task-2", "Draft the changelog")] };
});

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => TASKS) }));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(async () => ""),
  watch: vi.fn(async () => async () => {}),
}));

// SidebarProvider reads matchMedia, which jsdom does not implement.
beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

const SHORTCUT = "Mod+Shift+F";

function file(relPath: string, name: string): MarkdownFile {
  return {
    path: `/ws/voice/${relPath}`,
    relPath,
    name,
    title: name.replace(/\.md$/, ""),
    tags: [],
    size: 0,
    modified: 0,
  };
}

function contentEntry(): SearchEntry {
  return {
    path: "/ws/voice/notes/alpha.md",
    relPath: "notes/alpha.md",
    title: "Alpha Guide",
    score: 4,
    lines: [
      {
        line: 12,
        segments: [
          { text: "the ", isMatch: false },
          { text: "coturn", isMatch: true },
          { text: " relay", isMatch: false },
        ],
        leadingEllipsis: true,
        trailingEllipsis: true,
      },
    ],
    matchedLines: 1,
  };
}

interface HarnessProps {
  lens?: SidebarLens;
  roots?: string[];
  filteredFiles?: MarkdownFile[];
  searchEntries?: SearchEntry[];
  defaultOpen?: boolean;
  onLensChange?: (lens: SidebarLens) => void;
}

function Harness({
  lens = "tree",
  roots = ["/ws/voice"],
  filteredFiles = [],
  searchEntries = [],
  defaultOpen = true,
  onLensChange = () => {},
}: HarnessProps) {
  const search = useSidebarSearch({ shortcut: SHORTCUT });
  const [open, setOpen] = useState(defaultOpen);
  return (
    <TooltipProvider>
      <SidebarProvider open={open} onOpenChange={setOpen}>
        <ExplorerSidebar
          roots={roots}
          activeRoot={roots[0]}
          activeScan={undefined}
          onPickDirectory={() => {}}
          onOpenWelcome={undefined}
          lens={lens}
          onLensChange={onLensChange}
          search={search}
          searchEntries={searchEntries}
          searchingContents={false}
          searchError={undefined}
          searchTruncated={false}
          filteredFiles={filteredFiles}
          pinnedFiles={[]}
          tree={undefined}
          rootKey={roots[0] ?? ""}
          isExpanded={() => false}
          onToggleExpanded={() => {}}
          isPinned={() => false}
          onTogglePin={() => {}}
          onHide={() => {}}
          hiddenCount={0}
          onOpenSettings={() => {}}
          selectedPath={undefined}
          onSelectFile={() => {}}
          onOpenInNewTab={() => {}}
        />
      </SidebarProvider>
    </TooltipProvider>
  );
}

function pressWorkspaceSearch() {
  fireEvent.keyDown(window, { key: "F", ctrlKey: true, shiftKey: true });
}

describe("ExplorerSidebar", () => {
  it("starts below the toolbar instead of at the top of the window", () => {
    const { container } = render(<Harness />);
    const panel = container.querySelector('[data-slot="sidebar-container"]');
    expect(panel?.className).toContain("top-(--toolbar-height)");
    expect(panel?.className).not.toContain("h-svh");
  });

  it("leaves the workspace switcher to the toolbar", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: /switch workspace/i })).toBeNull();
  });

  it("reserves no title-bar offset in its header", () => {
    const { container } = render(<Harness />);
    for (const header of container.querySelectorAll('[data-slot="sidebar-header"]')) {
      expect(header.className).not.toContain("pt-9");
    }
  });
});

describe("one search for the whole sidebar", () => {
  it("keeps the search out of the way until it is asked for", () => {
    render(<Harness />);

    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });

  it("reveals the input and puts the caret in it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Search" }));

    const input = screen.getByRole("textbox", { name: "Search" });
    expect(input).toHaveFocus();
  });

  it("returns the space to the lens when dismissed", async () => {
    const user = userEvent.setup();
    render(<Harness filteredFiles={[file("notes/alpha.md", "alpha.md")]} />);

    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.type(screen.getByRole("textbox", { name: "Search" }), "coturn");
    await user.click(screen.getByRole("button", { name: "Hide search" }));

    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.getByRole("button", { name: "Search" })).toHaveFocus();
  });

  it("dismisses on Escape from the input", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.type(screen.getByRole("textbox", { name: "Search" }), "coturn{Escape}");

    expect(screen.queryByRole("search")).toBeNull();
  });

  it("opens and focuses the search from the workspace shortcut", async () => {
    render(<Harness />);

    pressWorkspaceSearch();

    expect(await screen.findByRole("textbox", { name: "Search" })).toHaveFocus();
  });

  it("shows content matches with their lines once a query is typed", async () => {
    const user = userEvent.setup();
    render(<Harness searchEntries={[contentEntry()]} />);

    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.type(screen.getByRole("textbox", { name: "Search" }), "coturn");

    expect(screen.getByText("Alpha Guide")).toBeInTheDocument();
    expect(screen.getByText("coturn")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("announces the pressed scope chip and switches scope", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(screen.getByRole("button", { name: "Filter results" }));

    const all = screen.getByRole("button", { name: "All", pressed: true });
    expect(all).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tags" }));

    expect(screen.getByRole("button", { name: "Tags", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All", pressed: false })).toBeInTheDocument();
  });

  it("filters the tasks board with the same query", async () => {
    const user = userEvent.setup();
    render(<Harness lens="tasks" />);
    expect(await screen.findByText("Wire the relay")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.type(screen.getByRole("textbox", { name: "Search" }), "changelog");

    expect(screen.getByText("Draft the changelog")).toBeInTheDocument();
    expect(screen.queryByText("Wire the relay")).not.toBeInTheDocument();
  });

  it("offers no content scopes on the tasks lens, where they mean nothing", async () => {
    const user = userEvent.setup();
    render(<Harness lens="tasks" />);

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.queryByRole("button", { name: "Filter results" })).toBeNull();
  });
});

describe("collapsing to the lens rail", () => {
  const LENS_LABELS = ["Tree", "Recent", "Tags", "Pinned", "Tasks"];

  it("keeps every lens reachable with the content column gone", () => {
    render(<Harness defaultOpen={false} />);

    for (const label of LENS_LABELS) {
      expect(screen.getByRole("tab", { name: label })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
  });

  it("brings the content column back when a lens is chosen", async () => {
    const user = userEvent.setup();
    const onLensChange = vi.fn();
    render(<Harness defaultOpen={false} onLensChange={onLensChange} />);

    await user.click(screen.getByRole("tab", { name: "Recent" }));

    expect(onLensChange).toHaveBeenCalledWith("recent");
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });

  // It stays in the rail through both states: moving it made the lens items
  // jump, since the rail gained a row only while collapsed.
  it("keeps the toggle in the rail through a collapse and back", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    const rail = () => container.querySelector('[data-slot="sidebar"]');
    const collapse = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(rail()?.contains(collapse)).toBe(true);
    expect(collapse.closest('[data-slot="sidebar-header"]')).toBeNull();

    await user.click(collapse);

    const expand = screen.getByRole("button", { name: "Expand sidebar" });
    expect(rail()?.contains(expand)).toBe(true);
    expect(screen.getAllByRole("tab")).toHaveLength(LENS_LABELS.length);

    await user.click(expand);
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("still answers the sidebar keyboard shortcut", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });

  it("still offers a way out when there is no workspace to show a rail", () => {
    render(<Harness roots={[]} defaultOpen={false} />);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });
});
