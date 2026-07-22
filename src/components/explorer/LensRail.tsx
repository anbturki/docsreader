import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SIDEBAR_LENSES, type SidebarLens } from "@/lib/storage";
import { LENS_META } from "./lenses";

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
                const { label, icon: Icon } = LENS_META[lens];
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
