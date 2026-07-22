import { renderHook } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { ACCENT_HUE } from "@/lib/storage";
import { ACCENT_HUE_PROPERTY, useTheme } from "./useTheme";

afterEach(() => {
  document.documentElement.removeAttribute("style");
  document.documentElement.classList.remove("dark");
});

describe("useTheme", () => {
  it("writes the hue and nothing else, leaving the colours to the stylesheet", () => {
    renderHook(() => useTheme("light", "green"));
    const { style } = document.documentElement;

    expect(style.getPropertyValue(ACCENT_HUE_PROPERTY)).toBe(String(ACCENT_HUE.green));
    expect(style.getPropertyValue("--primary")).toBe("");
    expect(style.getPropertyValue("--primary-fixed")).toBe("");
    expect(style.getPropertyValue("--ring")).toBe("");
  });

  it("keeps the same hue across schemes", () => {
    const { rerender } = renderHook(({ dark }: { dark: boolean }) =>
      useTheme(dark ? "dark" : "light", "rose")
    , { initialProps: { dark: false } });
    const light = document.documentElement.style.getPropertyValue(ACCENT_HUE_PROPERTY);

    rerender({ dark: true });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.getPropertyValue(ACCENT_HUE_PROPERTY)).toBe(light);
  });
});
