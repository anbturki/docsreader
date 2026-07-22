import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import {
  searchContent,
  SEARCH_FAILED_MESSAGE,
  EMPTY_CONTENT_SEARCH,
  type ContentSearchResult,
} from "./contentSearch";

const mockedInvoke = vi.mocked(invoke);

const found: ContentSearchResult = {
  hits: [],
  aborted: false,
  truncated: false,
  failedRoots: [],
};

describe("searchContent", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("names the calling surface so cancellation stays scoped to it", async () => {
    mockedInvoke.mockResolvedValue(found);

    await searchContent(["/lib"], "needle", "all", "sidebar");

    expect(mockedInvoke).toHaveBeenCalledWith("search_content", {
      paths: ["/lib"],
      query: "needle",
      scope: "all",
      surface: "sidebar",
    });
  });

  it("reports the folders that could not be searched", async () => {
    mockedInvoke.mockResolvedValue({ ...found, failedRoots: ["/gone"] });

    const result = await searchContent(["/gone"], "needle", "all", "sidebar");

    expect(result.failedRoots).toEqual(["/gone"]);
  });

  it("replaces a backend failure with a message a reader can act on", async () => {
    mockedInvoke.mockRejectedValue(new Error("ENOENT: /gone"));

    await expect(searchContent(["/gone"], "needle", "all", "sidebar")).rejects.toThrow(
      SEARCH_FAILED_MESSAGE
    );
  });

  it("does not call the backend without a query or a folder", async () => {
    expect(await searchContent(["/lib"], "  ", "all", "sidebar")).toBe(EMPTY_CONTENT_SEARCH);
    expect(await searchContent([], "needle", "all", "sidebar")).toBe(EMPTY_CONTENT_SEARCH);
    expect(mockedInvoke).not.toHaveBeenCalled();
  });
});
