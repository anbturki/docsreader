import type { CSSProperties } from "react";

export const CHROME_STYLE: CSSProperties &
  Record<"--sidebar-width" | "--toolbar-height", string> = {
  "--sidebar-width": "20rem",
  "--toolbar-height": "2.75rem",
};
