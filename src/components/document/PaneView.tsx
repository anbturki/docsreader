import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { MarkdownFile } from "@/lib/scan";
import type { ViewSettings } from "@/lib/storage";
import type { Tabs } from "@/hooks/useTabs";
import { EmptyDocument } from "./EmptyDocument";
import { TabBar } from "./TabBar";
import { TAB_KIND_VIEWS } from "./tabKinds";

interface Props {
  pane: Tabs;
  files: MarkdownFile[];
  rootPath: string | undefined;
  viewSettings: ViewSettings;
  // Active-pane styling and focus capture. When `splitActive` is
  // false, this pane is rendered standalone (split off) and no focus
  // ring is shown.
  splitActive: boolean;
  isActivePane: boolean;
  onFocusPane: () => void;
  onActiveScrollElChange: (el: HTMLElement | null) => void;
  onDiffViewModeChange: (mode: ViewSettings["diffViewMode"]) => void;
  onAlwaysAutoReload: () => void;
  onOpenInOtherPane?: (path: string) => void;
  // hasRoots controls the empty-state message inside EmptyDocument.
  hasRoots: boolean;
}

export function PaneView({
  pane,
  files,
  rootPath,
  viewSettings,
  splitActive,
  isActivePane,
  onFocusPane,
  onActiveScrollElChange,
  onDiffViewModeChange,
  onAlwaysAutoReload,
  onOpenInOtherPane,
  hasRoots,
}: Props) {
  // Capture mousedown so that clicking inside an unfocused pane focuses
  // the pane before the click's natural handler runs (e.g. tab activate).
  const handleMouseDown = useCallback(() => {
    if (splitActive && !isActivePane) onFocusPane();
  }, [splitActive, isActivePane, onFocusPane]);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col",
        splitActive && "ring-inset transition-shadow",
        splitActive && isActivePane && "ring-1 ring-ring/40",
        splitActive && !isActivePane && "ring-1 ring-transparent"
      )}
      onMouseDown={handleMouseDown}
    >
      <TabBar
        tabs={pane.tabs}
        activeId={pane.activeId}
        onActivate={pane.activate}
        onClose={pane.close}
      />
      <div className="relative flex-1 min-h-0">
        {pane.tabs.length === 0 ? (
          <div className="absolute inset-0 overflow-y-auto">
            <EmptyDocument hasRoots={hasRoots} />
          </div>
        ) : (
          pane.tabs.map((tab) => {
            const Content = TAB_KIND_VIEWS[tab.kind].content;
            return (
              <Content
                key={tab.id}
                tab={tab}
                pane={pane}
                active={tab.id === pane.activeId}
                files={files}
                rootPath={rootPath}
                viewSettings={viewSettings}
                paneFocused={!splitActive || isActivePane}
                onActiveScrollElChange={onActiveScrollElChange}
                onDiffViewModeChange={onDiffViewModeChange}
                onAlwaysAutoReload={onAlwaysAutoReload}
                onOpenInOtherPane={onOpenInOtherPane}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
