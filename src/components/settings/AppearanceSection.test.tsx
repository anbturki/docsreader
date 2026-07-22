import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ACCENT_HUE, defaultViewSettings, type AccentColor } from "@/lib/storage";
import { ACCENT_HUE_PROPERTY } from "@/hooks/useTheme";
import { AppearanceSection } from "./AppearanceSection";

function renderSection() {
  return render(<AppearanceSection settings={defaultViewSettings} onChange={vi.fn()} />);
}

describe("AppearanceSection", () => {
  it("draws each swatch from the shared accent definition, never its own colour", () => {
    const { container } = renderSection();
    const swatches = container.querySelectorAll<HTMLElement>(".accent-swatch");

    expect(swatches).toHaveLength(Object.keys(ACCENT_HUE).length);
    for (const swatch of swatches) {
      // The stylesheet composes the colour; the swatch supplies only the hue.
      expect(swatch.style.background).toBe("");
      expect(swatch.style.backgroundColor).toBe("");
      expect(swatch.style.getPropertyValue(ACCENT_HUE_PROPERTY)).not.toBe("");
    }
  });

  it("gives every accent its own hue, in the settings order", () => {
    const { container } = renderSection();
    const hues = [...container.querySelectorAll<HTMLElement>(".accent-swatch")].map((el) =>
      Number(el.style.getPropertyValue(ACCENT_HUE_PROPERTY))
    );

    const accents = Object.keys(ACCENT_HUE) as AccentColor[];
    expect(hues).toEqual(accents.map((accent) => ACCENT_HUE[accent]));
  });
});
