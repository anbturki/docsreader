import { act, renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { TASKS_TARGET } from "@/lib/tabKinds";
import { usePanes } from "./usePanes";

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(async () => ""),
  writeTextFile: vi.fn(async () => {}),
  watch: vi.fn(async () => () => {}),
}));

vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  loadTabsState: vi.fn(async () => ({ targets: [], activeKey: undefined, scrollByPath: {} })),
  saveTabsState: vi.fn(async () => {}),
  loadPaneLayout: vi.fn(async () => ({
    split: "off" as const,
    splitSize: 50,
    activePane: 0 as const,
  })),
  savePaneLayout: vi.fn(async () => {}),
}));

async function renderPanes() {
  const hook = renderHook(() =>
    usePanes({ autoReloadOnExternalChange: false, isManagedPath: () => false })
  );
  await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("a tab that is not a file across panes", () => {
  it("opens in the other pane, splitting the view", async () => {
    const { result } = await renderPanes();

    act(() => result.current.openInOtherPane(TASKS_TARGET));

    await waitFor(() => expect(result.current.panes[1].tabs).toHaveLength(1));
    expect(result.current.panes[1].tabs[0].kind).toBe("tasks");
    expect(result.current.panes[0].tabs).toHaveLength(0);
    expect(result.current.layout.split).toBe("horizontal");
    expect(result.current.layout.activePane).toBe(1);
  });

  it("opens in whichever pane is active", async () => {
    const { result } = await renderPanes();

    act(() => result.current.openInActivePane(TASKS_TARGET));

    await waitFor(() => expect(result.current.panes[0].tabs).toHaveLength(1));
    expect(result.current.panes[0].tabs[0].kind).toBe("tasks");
    expect(result.current.panes[1].tabs).toHaveLength(0);
  });
});
