import { useCallback } from "react";
import { fileTarget } from "@/lib/tabKinds";
import type { TabContentProps } from "./tabKinds";
import { TabScrollPane } from "./TabScrollPane";

export function FileTabContent({
  tab,
  pane,
  active,
  files,
  rootPath,
  viewSettings,
  paneFocused,
  onActiveScrollElChange,
  onDiffViewModeChange,
  onAlwaysAutoReload,
}: TabContentProps) {
  const openInActive = pane.openInActive;
  const navigate = useCallback(
    (path: string) => openInActive(fileTarget(path)),
    [openInActive]
  );

  return (
    <TabScrollPane
      tab={tab}
      file={files.find((f) => f.path === tab.ref)}
      active={active}
      rootPath={rootPath}
      viewSettings={viewSettings}
      initialScrollTop={pane.getScrollTop(tab.ref)}
      onScrollChange={pane.setScrollTop}
      onNavigate={navigate}
      onActiveRefChange={onActiveScrollElChange}
      paneFocused={paneFocused}
      onAcceptPending={pane.acceptPending}
      onDismissPending={pane.dismissPending}
      onDiffViewModeChange={onDiffViewModeChange}
      onAlwaysAutoReload={onAlwaysAutoReload}
      onBeginEdit={pane.beginEdit}
      onCancelEdit={pane.cancelEdit}
      onSaveEdit={pane.saveEdit}
      onToggleTask={pane.toggleTaskItem}
    />
  );
}
