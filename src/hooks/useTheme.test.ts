import { renderHook } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { ACCENT_COLORS, ACCENT_SPEC } from "@/lib/storage";
import { ACCENT_PROPERTIES, accentProperties, useTheme } from "./useTheme";

afterEach(() => {
  document.documentElement.removeAttribute("style");
  document.documentElement.classList.remove("dark");
});

describe("useTheme", () => {
  it("writes the accent parts and nothing else, leaving the colours to the stylesheet", () => {
    renderHook(() => useTheme("light", "green"));
    const { style } = document.documentElement;

    expect(style.getPropertyValue(ACCENT_PROPERTIES.lightness)).toBe("0.55");
    expect(style.getPropertyValue(ACCENT_PROPERTIES.chroma)).toBe("0.22");
    expect(style.getPropertyValue(ACCENT_PROPERTIES.hue)).toBe("145");
    expect(style.getPropertyValue("--primary")).toBe("");
    expect(style.getPropertyValue("--primary-fixed")).toBe("");
    expect(style.getPropertyValue("--ring")).toBe("");
  });

  it("keeps the same accent across schemes", () => {
    const { rerender } = renderHook(({ dark }: { dark: boolean }) =>
      useTheme(dark ? "dark" : "light", "rose")
    , { initialProps: { dark: false } });
    const read = () =>
      Object.values(ACCENT_PROPERTIES).map((property) =>
        document.documentElement.style.getPropertyValue(property)
      );
    const light = read();

    rerender({ dark: true });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(read()).toEqual(light);
  });

  it("carries a full colour for every accent, not a hue alone", () => {
    for (const accent of ACCENT_COLORS) {
      const spec = ACCENT_SPEC[accent];
      expect(accentProperties(accent)).toEqual({
        [ACCENT_PROPERTIES.lightness]: String(spec.lightness),
        [ACCENT_PROPERTIES.chroma]: String(spec.chroma),
        [ACCENT_PROPERTIES.hue]: String(spec.hue),
      });
    }
  });

  it("leaves the accents that shipped before untouched", () => {
    for (const accent of ["violet", "blue", "green", "orange", "rose", "slate"] as const) {
      expect(ACCENT_SPEC[accent].lightness).toBe(0.55);
      expect(ACCENT_SPEC[accent].chroma).toBe(0.22);
    }
    expect(ACCENT_SPEC.violet.hue).toBe(280);
    expect(ACCENT_SPEC.blue.hue).toBe(240);
    expect(ACCENT_SPEC.green.hue).toBe(145);
    expect(ACCENT_SPEC.orange.hue).toBe(40);
    expect(ACCENT_SPEC.rose.hue).toBe(0);
    expect(ACCENT_SPEC.slate.hue).toBe(250);
  });
});
