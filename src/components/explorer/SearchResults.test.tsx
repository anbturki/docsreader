import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { SearchResults } from "./SearchResults";
import type { SearchEntry } from "@/lib/searchEntries";

vi.mock("@tauri-apps/plugin-opener", () => ({ revealItemInDir: vi.fn() }));

const handlers = {
  onSelect: vi.fn(),
  onOpenInNewTab: vi.fn(),
  onTogglePin: vi.fn(),
};

function entry(overrides: Partial<SearchEntry> = {}): SearchEntry {
  return {
    path: "/ws/notes/alpha.md",
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
    ...overrides,
  };
}

function renderResults(props: Partial<React.ComponentProps<typeof SearchResults>> = {}) {
  return render(
    <SearchResults
      entries={[entry()]}
      searching={false}
      error={undefined}
      truncated={false}
      selectedPath={undefined}
      isPinned={() => false}
      {...handlers}
      {...props}
    />
  );
}

describe("SearchResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the document title and its matched snippet", () => {
    renderResults();

    expect(screen.getByText("Alpha Guide")).toBeInTheDocument();
    expect(screen.getByText("coturn")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("marks the matched text so it stands out from its context", () => {
    renderResults();

    const marked = screen.getByText("coturn");
    expect(marked.tagName).toBe("MARK");
  });

  it("renders snippet text without injecting markup", () => {
    renderResults({
      entries: [
        entry({
          lines: [
            {
              line: 1,
              segments: [{ text: "<img src=x onerror=alert(1)>", isMatch: false }],
              leadingEllipsis: false,
              trailingEllipsis: false,
            },
          ],
        }),
      ],
    });

    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("opens the document when a result is clicked", async () => {
    const user = userEvent.setup();
    renderResults();

    await user.click(screen.getByText("Alpha Guide"));

    expect(handlers.onSelect).toHaveBeenCalledWith("/ws/notes/alpha.md");
  });

  it("falls back to the file name when the document has no title", () => {
    renderResults({ entries: [entry({ title: undefined })] });

    expect(screen.getByText("alpha.md")).toBeInTheDocument();
  });

  it("reports matched lines beyond the shown ones", () => {
    renderResults({ entries: [entry({ matchedLines: 4 })] });

    expect(screen.getByText("3 more lines")).toBeInTheDocument();
  });

  it("uses the singular form for a single extra line", () => {
    renderResults({ entries: [entry({ matchedLines: 2 })] });

    expect(screen.getByText("1 more line")).toBeInTheDocument();
  });

  it("shows a name-only match with no snippet", () => {
    renderResults({ entries: [entry({ lines: [], matchedLines: 0, score: 0 })] });

    expect(screen.getByText("Alpha Guide")).toBeInTheDocument();
    expect(screen.queryByText("coturn")).not.toBeInTheDocument();
  });

  it("says nothing matched once the search settles", () => {
    renderResults({ entries: [], searching: false });

    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("says it is still searching before results arrive", () => {
    renderResults({ entries: [], searching: true });

    expect(screen.getByText("Searching…")).toBeInTheDocument();
    expect(screen.queryByText("No matches")).not.toBeInTheDocument();
  });

  it("keeps showing name matches while contents are still being searched", () => {
    renderResults({ searching: true });

    expect(screen.getByText("Alpha Guide")).toBeInTheDocument();
    expect(screen.getByText("Searching contents…")).toBeInTheDocument();
  });

  it("surfaces a failure without any technical detail", () => {
    renderResults({ error: "This folder could not be searched." });

    expect(screen.getByText("Search unavailable")).toBeInTheDocument();
    expect(screen.getByText("This folder could not be searched.")).toBeInTheDocument();
  });

  it("warns when the folder is too large to search completely", () => {
    renderResults({ truncated: true });

    expect(
      screen.getByText("This folder is too large to search completely.")
    ).toBeInTheDocument();
  });
});
