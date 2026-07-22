import { Clock, FolderTree, ListChecks, Pin, Search, Tag, type LucideIcon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SIDEBAR_LENSES, type SidebarLens } from "@/lib/storage";

const LENSES: Record<SidebarLens, { label: string; icon: LucideIcon }> = {
  tree: { label: "Tree", icon: FolderTree },
  recent: { label: "Recent", icon: Clock },
  tags: { label: "Tags", icon: Tag },
  pinned: { label: "Pinned", icon: Pin },
  tasks: { label: "Tasks", icon: ListChecks },
  search: { label: "Search", icon: Search },
};

interface Props {
  active: SidebarLens;
  onChange: (lens: SidebarLens) => void;
}

export function LensRail({ active, onChange }: Props) {
  return (
    <Sidebar
      collapsible="none"
      className="w-fit min-w-(--sidebar-width-icon) shrink-0 border-r border-sidebar-border"
    >
      {/* Clears the window title bar, matching the content column's header offset. */}
      <SidebarHeader data-tauri-drag-region className="p-0 pt-9" />
      <SidebarContent>
        <SidebarGroup className="p-1">
          <SidebarGroupContent>
            <SidebarMenu
              role="tablist"
              aria-orientation="vertical"
              aria-label="Sidebar lens"
              className="gap-1"
            >
              {SIDEBAR_LENSES.map((lens) => {
                const { label, icon: Icon } = LENSES[lens];
                const isActive = lens === active;
                return (
                  <SidebarMenuItem key={lens} role="presentation">
                    <SidebarMenuButton
                      role="tab"
                      aria-selected={isActive}
                      isActive={isActive}
                      onClick={() => onChange(lens)}
                      className="h-auto flex-col gap-0.5 px-1 py-1.5 text-center text-xs whitespace-nowrap"
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
