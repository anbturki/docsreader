import type { CSSProperties } from "react";

// Tauri reads the window-control position from src-tauri/tauri.conf.json at build
// time, so JSON cannot reference this file and this file cannot import it. These
// numbers mirror app.windows[0].trafficLightPosition; AppToolbar.test.tsx reads the
// config back and fails if the two drift.
//
// `y` is not a top offset. Measured in a running window at two values, the top
// edge lands at `y - 9`: y=18 put it at 9, y=22 at 13. Centring the 14px
// controls in the 36px bar wants a top edge of 11, so y = 20. Both earlier
// values came from reasoning about what the platform ought to do; only the
// measurement settled it, so re-measure rather than re-derive if the bar height
// changes.
export const MAC_WINDOW_CONTROLS = { x: 11, y: 20 } as const;

// Close, minimise and zoom are 14px wide, pitched 23px apart: 11 to 71 measured
// in a running window, so the group spans 60 rather than the 54 first assumed.
const MAC_WINDOW_CONTROLS_SPAN = 60;
const MAC_WINDOW_CONTROLS_CLEARANCE = 12;

const windowControlsInset =
  MAC_WINDOW_CONTROLS.x + MAC_WINDOW_CONTROLS_SPAN + MAC_WINDOW_CONTROLS_CLEARANCE;

export const CHROME_STYLE: CSSProperties &
  Record<
    | "--sidebar-width"
    | "--sidebar-width-icon"
    | "--toolbar-height"
    | "--window-controls-inset"
    | "--chrome-inset",
    string
  > = {
  "--sidebar-width": "20rem",
  // Collapsed width: the lens rail stacks a label under each icon, so it is
  // sized to the widest label ("Recent", 33.2px measured in Geist at text-2xs)
  // plus the rail's item and group padding.
  "--sidebar-width-icon": "3rem",
  "--toolbar-height": "2.25rem",
  "--window-controls-inset": `${windowControlsInset}px`,
  // Gap between the window edge and the floating surfaces (sidebar panel and
  // content card). shadcn's inset variant hardcodes this as `p-2`/`m-2`, which
  // reads as a wide margin at this window size.
  "--chrome-inset": "0.25rem",
};
