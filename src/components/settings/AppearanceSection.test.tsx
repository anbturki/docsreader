import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  ACCENT_COLORS,
  ACCENT_SPEC,
  COLOR_SCHEMES,
  defaultViewSettings,
  type ViewSettings,
} from "@/lib/storage";
import { ACCENT_PROPERTIES } from "@/hooks/useTheme";
import { AppearanceSection } from "./AppearanceSection";

function renderSection(settings: ViewSettings = defaultViewSettings) {
  return render(<AppearanceSection settings={settings} onChange={vi.fn()} />);
}

describe("AppearanceSection", () => {
  it("draws each swatch from the shared accent definition, never its own colour", () => {
    const { container } = renderSection();
    const swatches = container.querySelectorAll<HTMLElement>(".accent-swatch");

    expect(swatches).toHaveLength(ACCENT_COLORS.length);
    for (const swatch of swatches) {
      // The stylesheet composes the colour; the swatch supplies only the parts.
      expect(swatch.style.background).toBe("");
      expect(swatch.style.backgroundColor).toBe("");
      for (const property of Object.values(ACCENT_PROPERTIES)) {
        expect(swatch.style.getPropertyValue(property)).not.toBe("");
      }
    }
  });

  it("gives every accent its own full colour, in the defined order", () => {
    const { container } = renderSection();
    const drawn = [...container.querySelectorAll<HTMLElement>(".accent-swatch")].map((el) => ({
      lightness: Number(el.style.getPropertyValue(ACCENT_PROPERTIES.lightness)),
      chroma: Number(el.style.getPropertyValue(ACCENT_PROPERTIES.chroma)),
      hue: Number(el.style.getPropertyValue(ACCENT_PROPERTIES.hue)),
    }));

    expect(drawn).toEqual(ACCENT_COLORS.map((accent) => ACCENT_SPEC[accent]));
  });

  it("rims every chip in a colour that flips with the scheme, so none reads as an empty slot", () => {
    const { container } = renderSection();
    const swatches = [...container.querySelectorAll<HTMLElement>(".accent-swatch")];

    expect(swatches).toHaveLength(ACCENT_COLORS.length);
    for (const swatch of swatches) {
      expect(swatch.className).toContain("border-muted-foreground");
      // The default rim is a tint of the card, invisible under a dark chip.
      expect(swatch.className).not.toMatch(/(^| )border-border($| )/);
    }
  });

  it("offers every accent and every scheme as a named, checkable choice", () => {
    renderSection();
    const accents = screen.getByRole("radiogroup", { name: "Accent color" });
    const schemes = screen.getByRole("radiogroup", { name: "Color scheme" });

    expect(within(accents).getAllByRole("radio")).toHaveLength(ACCENT_COLORS.length);
    expect(within(schemes).getAllByRole("radio")).toHaveLength(COLOR_SCHEMES.length);
    for (const radio of within(accents).getAllByRole("radio")) {
      expect(radio).toHaveAccessibleName(expect.stringMatching(/\S/));
    }
  });

  it("marks the selection with state, not with colour alone", () => {
    renderSection({ ...defaultViewSettings, accentColor: "bronze", colorScheme: "dark" });

    expect(screen.getByRole("radio", { name: "Bronze" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Rose" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  });
});
