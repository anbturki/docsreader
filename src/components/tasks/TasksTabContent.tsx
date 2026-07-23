import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/controls/SearchField";
import { COMPACT_CONTROL_ICON } from "@/components/controls/controlHeight";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { fileTarget } from "@/lib/tabKinds";
import { taskCountLabel } from "@/lib/taskFilter";
import {
  TaskFilterProvider,
  useTaskFilter,
} from "@/components/explorer/TaskFilterContext";
import { TaskFilterPopover } from "@/components/explorer/TaskFilterPopover";
import type { TabContentProps } from "@/components/document/tabKinds";
import { TasksLens } from "./TasksLens";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { TASK_VIEWS } from "./taskViews";

export function TasksTabContent({
  pane,
  active,
  rootPath,
  viewSettings,
  onOpenInOtherPane,
}: TabContentProps) {
  const [query, setQuery] = useState("");
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined);

  const { openInActive, openInNew } = pane;
  const navigate = useCallback(
    (path: string) => openInActive(fileTarget(path)),
    [openInActive]
  );
  const openInNewTab = useCallback(
    (path: string) => openInNew(fileTarget(path)),
    [openInNew]
  );
  const refresh = useCallback(() => setRefreshSignal((n) => n + 1), []);

  const viewDef = TASK_VIEWS[viewSettings.taskTabView];
  const withDetail = viewDef.detail;
  // The pane appears once a task is picked and the close control puts it away,
  // handing the width back to the list.
  const detailShown = withDetail && selectedPath !== undefined;

  // In a detail view a row selects into the pane beside it; otherwise it opens.
  const lens = (
    <TasksLens
      className={detailShown ? "h-full min-h-0" : "min-h-0 flex-1"}
      view={viewDef.component}
      activeRoot={rootPath}
      query={query}
      refreshSignal={refreshSignal}
      selectedPath={withDetail ? selectedPath : undefined}
      onOpen={withDetail ? setSelectedPath : navigate}
      onOpenInNewTab={openInNewTab}
      onOpenInOtherPane={onOpenInOtherPane}
    />
  );

  return (
    <div
      className={cn("absolute inset-0 flex flex-col", !active && "invisible")}
      aria-hidden={!active}
    >
      <TaskFilterProvider>
        <TasksHeader query={query} onQueryChange={setQuery} onRefresh={refresh} />
        {withDetail && selectedPath !== undefined ? (
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
            <ResizablePanel defaultSize="58%" minSize="34%" className="min-w-0">
              {lens}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="42%" minSize="26%" className="min-w-0 border-l">
              <TaskDetailPanel
                path={selectedPath}
                rootPath={rootPath}
                viewSettings={viewSettings}
                reloadSignal={refreshSignal}
                onOpenFull={navigate}
                onNavigate={navigate}
                onChanged={refresh}
                onClose={() => setSelectedPath(undefined)}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          lens
        )}
      </TaskFilterProvider>
    </div>
  );
}

interface HeaderProps {
  query: string;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
}

function TasksHeader({ query, onQueryChange, onRefresh }: HeaderProps) {
  const { count } = useTaskFilter();

  return (
    <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1">
      <h2 className="text-sm font-medium">Tasks</h2>
      {count && (
        <span className="truncate text-xs text-muted-foreground">
          {taskCountLabel(count.shown, count.total)}
        </span>
      )}
      <SearchField
        value={query}
        onChange={onQueryChange}
        label="Search tasks"
        placeholder="Search tasks..."
        className="ml-auto w-56 max-w-[50%]"
      />
      <TaskFilterPopover />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn(COMPACT_CONTROL_ICON, "text-muted-foreground")}
        aria-label="Refresh tasks"
        onClick={onRefresh}
      >
        <RefreshCw />
      </Button>
    </div>
  );
}
