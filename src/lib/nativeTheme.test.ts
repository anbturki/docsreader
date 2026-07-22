import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { isTauri, setTheme, getCurrentWindow } = vi.hoisted(() => {
  const setTheme = vi.fn(async () => {});
  return {
    isTauri: vi.fn(() => true),
    setTheme,
    getCurrentWindow: vi.fn(() => ({ setTheme })),
  };
});

vi.mock("@tauri-apps/api/core", () => ({ isTauri }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow }));

import { useTheme } from "@/hooks/useTheme";
import { syncNativeTheme } from "./nativeTheme";

beforeEach(() => {
  isTauri.mockReset().mockReturnValue(true);
  setTheme.mockReset().mockResolvedValue(undefined);
  getCurrentWindow.mockClear();
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

describe("syncNativeTheme", () => {
  it("tells the window which scheme it is wearing", async () => {
    await syncNativeTheme("dark");
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("hands the choice back to the OS when following the system", async () => {
    await syncNativeTheme(null);
    expect(setTheme).toHaveBeenCalledWith(null);
  });

  it("does nothing outside the desktop shell, where there is no native chrome", async () => {
    isTauri.mockReturnValue(false);
    await syncNativeTheme("dark");
    expect(getCurrentWindow).not.toHaveBeenCalled();
  });
});

describe("useTheme keeps the window controls in step", () => {
  it("syncs the chosen scheme, so the controls are not drawn for the other one", async () => {
    renderHook(() => useTheme("dark", "violet"));
    await vi.waitFor(() => expect(setTheme).toHaveBeenCalledWith("dark"));
  });

  it("passes null for system rather than resolving it itself", async () => {
    renderHook(() => useTheme("system", "violet"));
    await vi.waitFor(() => expect(setTheme).toHaveBeenCalledWith(null));
  });
});
