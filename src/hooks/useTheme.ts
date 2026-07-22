import { useEffect } from "react";
import { ACCENT_HUE, type AccentColor, type ColorScheme } from "@/lib/storage";

const LIGHT_PRIMARY = (hue: number) => `oklch(0.55 0.22 ${hue})`;
const DARK_PRIMARY = (hue: number) => `oklch(0.7 0.18 ${hue})`;

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

  const hue = ACCENT_HUE[accent];
  const primary = scheme === "dark" ? DARK_PRIMARY(hue) : LIGHT_PRIMARY(hue);
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", primary);
  // Same accent in both schemes, for surfaces that stay put while the rest of
  // the UI inverts around them.
  root.style.setProperty("--primary-fixed", LIGHT_PRIMARY(hue));
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
