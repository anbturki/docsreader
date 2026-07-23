import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import { ListChecks } from "lucide-react";

import type { TabKind } from "@/lib/tabKinds";
import type { MarkdownFile } from "@/lib/scan";
import type { ViewSettings } from "@/lib/storage";
import type { Tab, Tabs } from "@/hooks/useTabs";
import { FileTabContent } from "./FileTabContent";
import { TasksTabContent } from "@/components/tasks/TasksTabContent";

export interface TabContentProps {
  tab: Tab;
  pane: Tabs;
  active: boolean;
  files: MarkdownFile[];
  rootPath: string | undefined;
  viewSettings: ViewSettings;
  paneFocused: boolean;
  onActiveScrollElChange: (el: HTMLElement | null) => void;
  onDiffViewModeChange: (mode: ViewSettings["diffViewMode"]) => void;
  onAlwaysAutoReload: () => void;
  onOpenInOtherPane?: (path: string) => void;
}

export interface TabKindView {
  content: ComponentType<TabContentProps>;
  // Set by a kind that opens on its own, with nothing to point at. Quick open
  // lists exactly these.
  standalone?: { label: string; hint: string; icon: LucideIcon };
}

export const TAB_KIND_VIEWS: Record<TabKind, TabKindView> = {
  file: { content: FileTabContent },
  tasks: {
    content: TasksTabContent,
    standalone: {
      label: "Tasks",
      hint: "Every task in this workspace, as a list or a board",
      icon: ListChecks,
    },
  },
};
