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
      // A card in its own right: one width and every corner rounded, in both
      // sidebar states, filled with the accent at one value that both schemes
      // share. Item states live on the items, never on this fill.
      className="w-(--sidebar-width-icon) shrink-0 rounded-md bg-primary-fixed text-primary-fixed-foreground"
    >
      <SidebarContent>
        <SidebarGroup className="gap-0.5 p-0.5">
          {/* Present in both states: appearing only when collapsed shifted every
              lens item down the rail. */}
          <SidebarGroupContent className="flex flex-col gap-0.5">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarToggle className={RAIL_ITEM} />
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarSeparator className="mx-0.5 bg-primary-fixed-foreground/25" />
          </SidebarGroupContent>
          <SidebarGroupContent>
            <SidebarMenu
              role="tablist"
              aria-orientation="vertical"
              aria-label="Sidebar lens"
              className="gap-0.5"
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
