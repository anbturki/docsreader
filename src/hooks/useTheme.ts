import { useEffect } from "react";
import type { CSSProperties } from "react";
import {
  ACCENT_SPEC,
  type AccentColor,
  type ColorScheme,
  type ResolvedScheme,
} from "@/lib/storage";

export const ACCENT_PROPERTIES = {
  lightness: "--primary-fixed-l",
  chroma: "--primary-fixed-c",
  hue: "--primary-fixed-hue",
} as const;

export type AccentCustomProperties = Record<
  (typeof ACCENT_PROPERTIES)[keyof typeof ACCENT_PROPERTIES],
  string
>;

export function accentProperties(
  accent: AccentColor,
): CSSProperties & AccentCustomProperties {
  const spec = ACCENT_SPEC[accent];
  const properties: AccentCustomProperties = {
    [ACCENT_PROPERTIES.lightness]: String(spec.lightness),
    [ACCENT_PROPERTIES.chroma]: String(spec.chroma),
    [ACCENT_PROPERTIES.hue]: String(spec.hue),
  };
  return properties;
}

function applyTheme(scheme: ResolvedScheme, accent: AccentColor): void {
  const root = document.documentElement;

  // Elements with `transition-colors` (e.g. task cards) would otherwise
  // animate their colors on theme switch while untransitioned elements snap,
  // causing a visible lag. Disable transitions, commit the change with a
  // forced reflow, then restore them so hover states still animate.
  const freeze = document.createElement("style");
  freeze.textContent = "*,*::before,*::after{transition:none !important}";
  document.head.appendChild(freeze);

  if (scheme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");

  // The accent is these three numbers and nothing else; the stylesheet owns how
  // they are drawn, in each scheme and on the fixed surfaces that ignore it.
  for (const [property, value] of Object.entries(accentProperties(accent))) {
    root.style.setProperty(property, value);
  }
  root.style.colorScheme = scheme;

  void root.offsetHeight;
  requestAnimationFrame(() => freeze.remove());
}

export function useTheme(colorScheme: ColorScheme, accentColor: AccentColor): void {
  useEffect(() => {
    if (colorScheme !== "system") {
      applyTheme(colorScheme, accentColor);
      return;
    }

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyTheme(mql.matches ? "dark" : "light", accentColor);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [colorScheme, accentColor]);
}
