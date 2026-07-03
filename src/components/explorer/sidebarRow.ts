import type { MouseEvent } from "react";

export const SIDEBAR_ROW =
  "flex w-full items-center gap-1.5 py-1 text-left text-[13px] transition-colors";

export function sidebarRowState(selected: boolean): string {
  return selected
    ? "bg-sidebar-accent text-sidebar-accent-foreground"
    : "hover:bg-sidebar-accent/50";
}

export function fileOpenHandlers(
  path: string,
  onSelect: (path: string) => void,
  onOpenInNewTab: (path: string) => void
) {
  return {
    onClick(e: MouseEvent) {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        onOpenInNewTab(path);
        return;
      }
      onSelect(path);
    },
    onAuxClick(e: MouseEvent) {
      if (e.button === 1) {
        e.preventDefault();
        onOpenInNewTab(path);
      }
    },
  };
}
