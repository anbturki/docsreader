import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { SIDEBAR_LENSES, type SidebarLens } from "@/lib/storage";
import { LENS_META } from "./lenses";
import { RAIL_ITEM } from "./railItem";
import { SidebarToggle } from "./SidebarToggle";

interface Props {
  active: SidebarLens;
  onChange: (lens: SidebarLens) => void;
}

export function LensRail({ active, onChange }: Props) {
  return (
    <Sidebar
      collapsible="none"
      // Overlap the container's own right border, which the collapsed panel
      // would otherwise show as a second line beside this one.
      className="w-[calc(var(--sidebar-width-icon)+1px)]! shrink-0 border-r border-sidebar-border"
    >
      <SidebarContent>
        <SidebarGroup className="gap-1 p-1">
          {/* Present in both states: appearing only when collapsed shifted every
              lens item down the rail. */}
          <SidebarGroupContent className="flex flex-col gap-1">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarToggle className={RAIL_ITEM} />
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarSeparator className="mx-1" />
          </SidebarGroupContent>
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
                      className={RAIL_ITEM}
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
