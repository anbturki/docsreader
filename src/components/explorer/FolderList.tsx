import { X } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface Props {
  roots: string[];
  activeRoot: string | undefined;
  onSelect: (path: string) => void;
  onRemove: (path: string) => void;
}

export function FolderList({ roots, activeRoot, onSelect, onRemove }: Props) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Folders</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {roots.map((root) => {
            const label = root.split("/").filter(Boolean).pop() || root;
            return (
              <SidebarMenuItem key={root}>
                <SidebarMenuButton
                  isActive={root === activeRoot}
                  tooltip={{ children: root, hidden: false }}
                  onClick={() => onSelect(root)}
                >
                  <span>{label}</span>
                </SidebarMenuButton>
                <SidebarMenuAction
                  showOnHover
                  title="Remove folder"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(root);
                  }}
                >
                  <X />
                  <span className="sr-only">Remove folder</span>
                </SidebarMenuAction>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
