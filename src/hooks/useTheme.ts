import { useEffect } from "react";
import { ACCENT_HUE, type AccentColor, type ColorScheme } from "@/lib/storage";

export const ACCENT_HUE_PROPERTY = "--primary-fixed-hue";

function applyTheme(scheme: "light" | "dark", accent: AccentColor): void {
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

  // The hue is the whole of the accent choice; the stylesheet owns how it is
  // drawn, in each scheme and for the fixed surfaces that ignore the scheme.
  root.style.setProperty(ACCENT_HUE_PROPERTY, String(ACCENT_HUE[accent]));
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
