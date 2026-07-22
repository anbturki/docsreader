import { act, renderHook } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { useContentSearch } from "./useContentSearch";
import { searchContent, type ContentHit, type ContentSearchResult } from "@/lib/contentSearch";

vi.mock("@/lib/contentSearch", async () => {
  const actual = await vi.importActual<typeof import("@/lib/contentSearch")>(
    "@/lib/contentSearch"
  );
  return { ...actual, searchContent: vi.fn() };
});

const mockedSearch = vi.mocked(searchContent);

function hit(relPath: string): ContentHit {
  return {
    path: `/lib/${relPath}`,
    relPath,
    score: 1,
    lines: [
      {
        line: 1,
        segments: [{ text: "needle", isMatch: true }],
        leadingEllipsis: false,
        trailingEllipsis: false,
      },
    ],
    matchedLines: 1,
  };
}

function result(hits: ContentHit[], overrides: Partial<ContentSearchResult> = {}) {
  return { hits, aborted: false, truncated: false, ...overrides };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}


async function settle(ms = 300) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useContentSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedSearch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns hits for a query", async () => {
    mockedSearch.mockResolvedValue(result([hit("a.md")]));
    const { result: state } = renderHook(() => useContentSearch("/lib", "needle"));

    await settle();

    expect(state.current.hits).toHaveLength(1);
    expect(state.current.hits[0].relPath).toBe("a.md");
    expect(state.current.searching).toBe(false);
  });

  it("debounces so a typed word issues one search", async () => {
    mockedSearch.mockResolvedValue(result([]));
    const { rerender } = renderHook(({ q }) => useContentSearch("/lib", q), {
      initialProps: { q: "n" },
    });

    rerender({ q: "ne" });
    rerender({ q: "nee" });
    rerender({ q: "needle" });
    await settle();

    expect(mockedSearch).toHaveBeenCalledTimes(1);
    expect(mockedSearch).toHaveBeenCalledWith("/lib", "needle", "all");
  });

  it("does not let a slow earlier search overwrite newer results", async () => {
    const slow = deferred<ContentSearchResult>();
    const fast = deferred<ContentSearchResult>();
    mockedSearch.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);

    const { rerender, result: state } = renderHook(({ q }) => useContentSearch("/lib", q), {
      initialProps: { q: "old" },
    });
    await settle();

    rerender({ q: "new" });
    await settle();

    fast.resolve(result([hit("new.md")]));
    await settle(0);
    expect(state.current.hits).toHaveLength(1);

    slow.resolve(result([hit("stale.md")]));
    await settle(50);

    expect(state.current.hits).toHaveLength(1);
    expect(state.current.hits[0].relPath).toBe("new.md");
  });

  it("discards a result the backend marked aborted", async () => {
    mockedSearch.mockResolvedValue(result([hit("partial.md")], { aborted: true }));
    const { result: state } = renderHook(() => useContentSearch("/lib", "needle"));

    await settle();

    expect(state.current.hits).toHaveLength(0);
  });

  it("clears results and searches nothing for a blank query", async () => {
    const { result: state } = renderHook(() => useContentSearch("/lib", "   "));

    await settle();

    expect(mockedSearch).not.toHaveBeenCalled();
    expect(state.current.hits).toHaveLength(0);
    expect(state.current.searching).toBe(false);
  });

  it("searches nothing without a folder", async () => {
    renderHook(() => useContentSearch(undefined, "needle"));

    await settle();

    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("passes the chosen scope through", async () => {
    mockedSearch.mockResolvedValue(result([]));
    renderHook(() => useContentSearch("/lib", "needle", true, "tags"));

    await settle();

    expect(mockedSearch).toHaveBeenCalledWith("/lib", "needle", "tags");
  });

  it("searches nothing while disabled", async () => {
    renderHook(() => useContentSearch("/lib", "needle", false));

    await settle();

    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("surfaces a failure message without dropping into a stuck searching state", async () => {
    mockedSearch.mockRejectedValue(new Error("This folder could not be searched."));
    const { result: state } = renderHook(() => useContentSearch("/lib", "needle"));

    await settle();

    expect(state.current.error).toBe("This folder could not be searched.");
    expect(state.current.searching).toBe(false);
    expect(state.current.hits).toHaveLength(0);
  });

  it("reports a truncated corpus", async () => {
    mockedSearch.mockResolvedValue(result([hit("a.md")], { truncated: true }));
    const { result: state } = renderHook(() => useContentSearch("/lib", "needle"));

    await settle();

    expect(state.current.truncated).toBe(true);
  });
});
