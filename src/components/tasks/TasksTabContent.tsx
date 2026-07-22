import { useCallback, useState } from "react";
import { RefreshCw, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fileTarget } from "@/lib/tabKinds";
import { taskCountLabel } from "@/lib/taskFilter";
import {
  TaskFilterProvider,
  useTaskFilter,
} from "@/components/explorer/TaskFilterContext";
import { TaskFilterPopover } from "@/components/explorer/TaskFilterPopover";
import type { TabContentProps } from "@/components/document/tabKinds";
import { TasksBoard } from "./TasksBoard";
import { TASK_TAB_VIEW } from "./taskViews";

export function TasksTabContent({
  pane,
  active,
  rootPath,
  onOpenInOtherPane,
}: TabContentProps) {
  const [query, setQuery] = useState("");
  const [refreshSignal, setRefreshSignal] = useState(0);

  const { openInActive, openInNew } = pane;
  const open = useCallback(
    (path: string) => openInActive(fileTarget(path)),
    [openInActive]
  );
  const openInNewTab = useCallback(
    (path: string) => openInNew(fileTarget(path)),
    [openInNew]
  );

  return (
    <div
      className={cn("absolute inset-0 flex flex-col", !active && "invisible")}
      aria-hidden={!active}
    >
      <TaskFilterProvider view={TASK_TAB_VIEW}>
        <BoardHeader
          query={query}
          onQueryChange={setQuery}
          onRefresh={() => setRefreshSignal((n) => n + 1)}
        />
        <TasksBoard
          className="min-h-0 flex-1"
          activeRoot={rootPath}
          query={query}
          refreshSignal={refreshSignal}
          selectedPath={undefined}
          onOpen={open}
          onOpenInNewTab={openInNewTab}
          onOpenInOtherPane={onOpenInOtherPane}
        />
      </TaskFilterProvider>
    </div>
  );
}

interface HeaderProps {
  query: string;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
}

function BoardHeader({ query, onQueryChange, onRefresh }: HeaderProps) {
  const { count } = useTaskFilter();

  return (
    <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
      <h2 className="text-sm font-medium">Tasks</h2>
      {count && (
        <span className="truncate text-xs text-muted-foreground">
          {taskCountLabel(count.shown, count.total)}
        </span>
      )}
      <div className="relative ml-auto w-56 max-w-[50%]">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search tasks"
          placeholder="Search tasks..."
          className="h-7 pl-7 text-xs"
        />
      </div>
      <TaskFilterPopover />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7 text-muted-foreground"
        aria-label="Refresh tasks"
        onClick={onRefresh}
      >
        <RefreshCw />
      </Button>
    </div>
  );
}
