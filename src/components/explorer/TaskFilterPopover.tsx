import { ListFilter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/tasks";
import { EMPTY_TASK_FILTER } from "@/lib/taskFilter";
import { useTaskFilter } from "./TaskFilterContext";

// Radix Select reserves the empty string, so "any" needs a sentinel value.
const ANY = "__any__";

export function TaskFilterPopover() {
  const { filter, setFilter, labels } = useTaskFilter();
  const active = filter.label !== null || filter.priority !== null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground aria-expanded:text-foreground"
          aria-label={active ? "Filter tasks, filters active" : "Filter tasks"}
        >
          <ListFilter className={active ? "text-foreground" : undefined} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <PopoverTitle>Filter tasks</PopoverTitle>
        <Select
          value={filter.priority ?? ANY}
          onValueChange={(v) =>
            setFilter({ ...filter, priority: v === ANY ? null : (v as TaskPriority) })
          }
        >
          <SelectTrigger size="sm" className="w-full text-xs" aria-label="Filter by priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any priority</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {labels.length > 0 && (
          <Select
            value={filter.label ?? ANY}
            onValueChange={(v) => setFilter({ ...filter, label: v === ANY ? null : v })}
          >
            <SelectTrigger size="sm" className="w-full text-xs" aria-label="Filter by label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any label</SelectItem>
              {labels.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {active && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="self-start text-xs text-muted-foreground"
            onClick={() => setFilter({ ...EMPTY_TASK_FILTER, text: filter.text })}
          >
            Clear filters
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
