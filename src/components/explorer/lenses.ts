import { Clock, FolderTree, ListChecks, Pin, Tag, type LucideIcon } from "lucide-react";

import type { SidebarLens } from "@/lib/storage";

export const LENS_META: Record<SidebarLens, { label: string; icon: LucideIcon }> = {
  tree: { label: "Tree", icon: FolderTree },
  recent: { label: "Recent", icon: Clock },
  tags: { label: "Tags", icon: Tag },
  pinned: { label: "Pinned", icon: Pin },
  tasks: { label: "Tasks", icon: ListChecks },
};
