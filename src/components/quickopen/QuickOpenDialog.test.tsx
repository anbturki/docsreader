import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { fileTarget, TASKS_TARGET } from "@/lib/tabKinds";
import QuickOpenDialog, { type QuickOpenFile } from "./QuickOpenDialog";
import { useContentSearch } from "@/hooks/useContentSearch";
import type { ContentHit } from "@/lib/contentSearch";

vi.mock("@/hooks/useContentSearch", () => ({ useContentSearch: vi.fn() }));

const mockedSearch = vi.mocked(useContentSearch);
const onSelect = vi.fn();

function file(relPath: string): QuickOpenFile {
  return {
    path: `/ws/${relPath}`,
    name: relPath.split("/").pop() ?? relPath,
    relPath,
    tags: [],
    size: 0,
    rootPath: "/ws",
  };
}

function hit(relPath: string): ContentHit {
  return {
    root: "/ws",
    path: `/ws/${relPath}`,
    relPath,
    score: 3,
    lines: [
      {
        line: 4,
        segments: [
          { text: "the ", isMatch: false },
          { text: "gateway", isMatch: true },
        ],
        leadingEllipsis: false,
        trailingEllipsis: true,
      },
    ],
    matchedLines: 1,
  };
}

function setHits(hits: ContentHit[]) {
  mockedSearch.mockReturnValue({
    hits,
    searching: false,
    error: undefined,
    truncated: false,
  });
}

function renderDialog(files: QuickOpenFile[]) {
  return render(
    <QuickOpenDialog
      open
      onOpenChange={vi.fn()}
      files={files}
      roots={["/ws"]}
      onSelect={onSelect}
    />
  );
}

describe("QuickOpenDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHits([]);
  });

  it("lists files by name", () => {
    renderDialog([file("notes/alpha.md")]);

    expect(screen.getByText("alpha.md")).toBeInTheDocument();
  });

  it("shows matches found inside documents in their own group", () => {
    setHits([hit("notes/deep.md")]);
    renderDialog([]);

    expect(screen.getByText("In documents")).toBeInTheDocument();
    expect(screen.getByText("notes/deep.md")).toBeInTheDocument();
    expect(screen.getByText("gateway")).toBeInTheDocument();
  });

  it("does not repeat a file already listed by name", () => {
    setHits([hit("notes/alpha.md")]);
    renderDialog([file("notes/alpha.md")]);

    expect(screen.queryByText("In documents")).not.toBeInTheDocument();
  });

  it("ignores hits that carry no matched line", () => {
    const nameOnly = { ...hit("notes/other.md"), lines: [], matchedLines: 0 };
    setHits([nameOnly]);
    renderDialog([]);

    expect(screen.queryByText("In documents")).not.toBeInTheDocument();
  });

  it("opens the document behind a content match", async () => {
    const user = userEvent.setup();
    setHits([hit("notes/deep.md")]);
    renderDialog([]);

    await user.click(screen.getByText("notes/deep.md"));

    expect(onSelect).toHaveBeenCalledWith(fileTarget("/ws/notes/deep.md"));
  });

  it("searches every open workspace", () => {
    renderDialog([]);

    expect(mockedSearch).toHaveBeenCalledWith(["/ws"], "", true, "all");
  });

  it("offers every scope filter", () => {
    renderDialog([]);

    for (const label of ["All", "Files", "Contents", "Tags"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("hides file matches when narrowed to contents", async () => {
    const user = userEvent.setup();
    setHits([hit("notes/deep.md")]);
    renderDialog([file("notes/alpha.md")]);
    expect(screen.getByText("alpha.md")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Contents" }));

    expect(screen.queryByText("alpha.md")).not.toBeInTheDocument();
    expect(screen.getByText("notes/deep.md")).toBeInTheDocument();
  });

  it("hides document matches when narrowed to files", async () => {
    const user = userEvent.setup();
    setHits([hit("notes/deep.md")]);
    renderDialog([file("notes/alpha.md")]);

    await user.click(screen.getByRole("button", { name: "Files" }));

    expect(screen.getByText("alpha.md")).toBeInTheDocument();
    expect(screen.queryByText("In documents")).not.toBeInTheDocument();
  });

  it("labels tag matches as tagged", async () => {
    const user = userEvent.setup();
    const tagged = { ...hit("notes/deep.md"), lines: [], matchedLines: 0 };
    setHits([tagged]);
    renderDialog([]);

    await user.click(screen.getByRole("button", { name: "Tags" }));

    expect(screen.getByText("Tagged")).toBeInTheDocument();
  });
});

describe("views reachable from quick open", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHits([]);
  });

  it("opens the tasks view without a file behind it", async () => {
    const user = userEvent.setup();
    renderDialog([file("notes/a.md")]);

    await user.click(screen.getByText("Tasks"));

    expect(onSelect).toHaveBeenCalledWith(TASKS_TARGET);
  });

  it("keeps the view listed while its name is being typed", async () => {
    const user = userEvent.setup();
    renderDialog([file("notes/a.md")]);

    await user.type(screen.getByPlaceholderText("Search files and contents..."), "task");

    expect(screen.getByText("Tasks")).toBeTruthy();
  });

  it("drops the view once the query cannot match it", async () => {
    const user = userEvent.setup();
    renderDialog([file("notes/a.md")]);

    await user.type(screen.getByPlaceholderText("Search files and contents..."), "notes");

    expect(screen.queryByText("Tasks")).toBeNull();
  });
});
