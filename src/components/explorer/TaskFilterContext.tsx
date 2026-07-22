import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { EMPTY_TASK_FILTER, type TaskFilter } from "@/lib/taskFilter";
import { LENS_VIEW_OPTIONS, type LensViewId } from "@/lib/storage";

const DEFAULT_TASK_VIEW: LensViewId = LENS_VIEW_OPTIONS.tasks[0];

export interface TaskCount {
  shown: number;
  total: number;
}

interface TaskFilterState {
  filter: TaskFilter;
  setFilter: (filter: TaskFilter) => void;
  /** Published by whoever holds the tasks, since only it knows the label set. */
  labels: string[];
  setLabels: (labels: string[]) => void;
  /** Published the same way, so the header can show it beside its controls. */
  count: TaskCount | undefined;
  setCount: (count: TaskCount | undefined) => void;
  /** Which of the lens's declared views the reader chose. */
  view: LensViewId;
  setView: (view: LensViewId) => void;
}

interface ProviderProps {
  children: ReactNode;
  /** Omitted where nothing persists the choice; the switch then works in place. */
  view?: LensViewId;
  onViewChange?: (view: LensViewId) => void;
}

const TaskFilterContext = createContext<TaskFilterState | undefined>(undefined);

export function TaskFilterProvider({ children, view, onViewChange }: ProviderProps) {
  const [filter, setFilter] = useState<TaskFilter>(EMPTY_TASK_FILTER);
  const [labels, setLabels] = useState<string[]>([]);
  const [count, setCount] = useState<TaskCount | undefined>(undefined);
  const [localView, setLocalView] = useState<LensViewId>(DEFAULT_TASK_VIEW);

  const activeView = view ?? localView;
  const setView = onViewChange ?? setLocalView;

  const value = useMemo<TaskFilterState>(
    () => ({
      filter,
      setFilter,
      labels,
      setLabels,
      count,
      setCount,
      view: activeView,
      setView,
    }),
    [filter, labels, count, activeView, setView]
  );

  return <TaskFilterContext.Provider value={value}>{children}</TaskFilterContext.Provider>;
}

export function useTaskFilter(): TaskFilterState {
  const state = useContext(TaskFilterContext);
  if (!state) throw new Error("useTaskFilter must be used inside a TaskFilterProvider");
  return state;
}
