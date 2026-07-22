import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeAll } from "vitest";

import { CHROME_STYLE } from "@/components/layout/chrome";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSidebarSearch } from "@/hooks/useSidebarSearch";
import type { SidebarLens } from "@/lib/storage";
import type { SearchEntry } from "@/lib/searchEntries";
import type { MarkdownFile } from "@/lib/scan";
import type { RootScan } from "@/hooks/useLibrary";

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
  activeScan?: RootScan;
  hiddenCount?: number;
  onRefresh?: () => void;
  onOpenSettings?: () => void;
}

function Harness({
  lens = "tree",
  roots = ["/ws/voice"],
  filteredFiles = [],
  searchEntries = [],
  defaultOpen = true,
  onLensChange = () => {},
  activeScan,
  hiddenCount = 0,
  onRefresh = () => {},
  onOpenSettings = () => {},
}: HarnessProps) {
  const search = useSidebarSearch({ shortcut: SHORTCUT });
  const [open, setOpen] = useState(defaultOpen);
  return (
    <TooltipProvider>
      <SidebarProvider open={open} onOpenChange={setOpen}>
        <ExplorerSidebar
          roots={roots}
          activeRoot={roots[0]}
          activeScan={activeScan}
          onPickDirectory={() => {}}
          onRefresh={onRefresh}
          onOpenWelcome={undefined}
          lens={lens}
          onLensChange={onLensChange}
          lensView={undefined}
          onLensViewChange={() => {}}
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
          hiddenCount={hiddenCount}
          onOpenSettings={onOpenSettings}
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

  it("insets the panel so the content area reads as a card", () => {
    const { container } = render(<Harness />);
    const sidebar = container.querySelector('[data-slot="sidebar"][data-variant]');
    expect(sidebar?.getAttribute("data-variant")).toBe("inset");
    expect(sidebar?.getAttribute("data-collapsible")).toBe("");
  });

  it("takes the inset gap from the shared chrome token, not the variant", () => {
    const { container } = render(<Harness />);
    const panel = container.querySelector('[data-slot="sidebar-container"]');
    expect(panel?.className).toContain("p-(--chrome-inset)");
    expect(panel?.className).not.toMatch(/(^| )p-2( |$)/);
    expect(panel?.className).toContain("var(--sidebar-width-icon)+var(--chrome-inset)");
    expect(CHROME_STYLE["--chrome-inset"]).toMatch(/rem$/);
  });

  it("draws one edge per panel, with nothing doubled at the seam", () => {
    const { container } = render(<Harness />);
    const [rail, column] = container.querySelectorAll('[data-slot="sidebar-inner"] > *');
    expect(rail.className).not.toContain("border");
    expect(column.className).toContain("border border-r-0 border-sidebar-border");
    // The gap is what keeps the column's left edge off the rail card.
    expect(column.className).toContain("ml-(--chrome-inset)");
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

function scanOf(files: MarkdownFile[]): RootScan {
  return {
    result: { root: "/ws/voice", files, truncated: false, skipped: 3 },
    scanning: false,
  };
}

describe("the sidebar footer", () => {
  it("no longer counts the workspace at the bottom of the panel", () => {
    const files = [file("notes/alpha.md", "alpha.md"), file("notes/beta.md", "beta.md")];
    const { container } = render(<Harness activeScan={scanOf(files)} filteredFiles={files} />);

    expect(screen.queryByText(/\d+ files/)).toBeNull();
    expect(screen.queryByText(/skipped/)).toBeNull();
    expect(container.querySelector('[data-slot="sidebar-footer"]')).toBeNull();
  });

  it("keeps the only way back to files that are hidden", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(<Harness activeScan={scanOf([])} hiddenCount={4} onOpenSettings={onOpenSettings} />);

    await user.click(screen.getByRole("button", { name: "4 hidden" }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});

describe("one title per lens", () => {
  it("names the tasks lens exactly once", async () => {
    render(<Harness lens="tasks" />);
    expect(await screen.findByText("Wire the relay")).toBeInTheDocument();

    expect(screen.getAllByText("Tasks")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Tasks" })).toBeInTheDocument();
  });
});

describe("workspace controls in the sidebar header", () => {
  function headerRow(container: HTMLElement) {
    const header = container.querySelector('[data-slot="sidebar-header"]');
    if (!header) throw new Error("no sidebar header");
    const row = header.firstElementChild;
    if (!row) throw new Error("no control row");
    return { header, row };
  }

  it("refreshes the workspace from the header", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    const { container } = render(<Harness onRefresh={onRefresh} />);

    const refresh = screen.getByRole("button", { name: "Refresh workspace" });
    expect(headerRow(container).row.contains(refresh)).toBe(true);

    await user.click(refresh);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("opens the task filters from beside the search", async () => {
    const user = userEvent.setup();
    render(<Harness lens="tasks" />);

    const trigger = screen.getByRole("button", { name: "Filter tasks" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const popover = screen.getByRole("dialog");
    expect(
      within(popover).getByRole("combobox", { name: "Filter by priority" })
    ).toBeInTheDocument();
  });

  it("offers no task filter on lenses that have none", () => {
    render(<Harness lens="tree" />);
    expect(screen.queryByRole("button", { name: "Filter tasks" })).toBeNull();
  });

  it("keeps the header geometry identical across lenses", async () => {
    const tree = render(<Harness lens="tree" />);
    const treeRow = headerRow(tree.container);
    const treeClasses = [treeRow.header.className, treeRow.row.className];
    const treeSizes = [...treeRow.row.querySelectorAll("button")].map((b) => b.className);
    tree.unmount();

    const tasks = render(<Harness lens="tasks" />);
    expect(await screen.findByText("Wire the relay")).toBeInTheDocument();
    const tasksRow = headerRow(tasks.container);

    expect([tasksRow.header.className, tasksRow.row.className]).toEqual(treeClasses);
    for (const classes of [...treeSizes, ...[...tasksRow.row.querySelectorAll("button")].map((b) => b.className)]) {
      expect(classes).toContain("size-7");
    }
  });
});
