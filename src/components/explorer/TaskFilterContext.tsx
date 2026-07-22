import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { EMPTY_TASK_FILTER, type TaskFilter } from "@/lib/taskFilter";

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
}

interface ProviderProps {
  children: ReactNode;
}

const TaskFilterContext = createContext<TaskFilterState | undefined>(undefined);

export function TaskFilterProvider({ children }: ProviderProps) {
  const [filter, setFilter] = useState<TaskFilter>(EMPTY_TASK_FILTER);
  const [labels, setLabels] = useState<string[]>([]);
  const [count, setCount] = useState<TaskCount | undefined>(undefined);

  const value = useMemo<TaskFilterState>(
    () => ({ filter, setFilter, labels, setLabels, count, setCount }),
    [filter, labels, count]
  );

  return <TaskFilterContext.Provider value={value}>{children}</TaskFilterContext.Provider>;
}

export function useTaskFilter(): TaskFilterState {
  const state = useContext(TaskFilterContext);
  if (!state) throw new Error("useTaskFilter must be used inside a TaskFilterProvider");
  return state;
}
