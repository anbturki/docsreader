import { useEffect } from "react";
import { ACCENT_HUE, type AccentColor, type ColorScheme } from "@/lib/storage";

const LIGHT_PRIMARY = (hue: number) => `oklch(0.55 0.22 ${hue})`;
const DARK_PRIMARY = (hue: number) => `oklch(0.7 0.18 ${hue})`;

function applyTheme(scheme: "light" | "dark", accent: AccentColor): void {
  const root = document.documentElement;
  if (scheme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");

  const hue = ACCENT_HUE[accent];
  const primary = scheme === "dark" ? DARK_PRIMARY(hue) : LIGHT_PRIMARY(hue);
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", primary);
  root.style.colorScheme = scheme;
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
