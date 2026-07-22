import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";

export const SIDEBAR_TOGGLE_LABELS = {
  expanded: "Collapse sidebar",
  collapsed: "Expand sidebar",
} as const;

export function SidebarToggle({ className }: { className?: string }) {
  const { state, toggleSidebar } = useSidebar();
  const label = SIDEBAR_TOGGLE_LABELS[state];
  const Icon = state === "collapsed" ? PanelLeftOpen : PanelLeftClose;

  return (
    <SidebarMenuButton
      aria-label={label}
      title={label}
      onClick={toggleSidebar}
      className={className}
    >
      <Icon />
    </SidebarMenuButton>
  );
}
