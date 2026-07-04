import { SearchInput } from "@/components/explorer/SearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/tasks";
import type { TaskFilter } from "@/lib/taskFilter";

// Radix Select reserves the empty string, so "any" needs a sentinel value.
const ANY = "__any__";

interface Props {
  filter: TaskFilter;
  labels: string[];
  onChange: (filter: TaskFilter) => void;
}

export function TaskBoardFilters({ filter, labels, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2 px-1">
      <SearchInput
        value={filter.text}
        onChange={(text) => onChange({ ...filter, text })}
        placeholder="Filter tasks by title..."
      />
      <div className="flex gap-2">
        <Select
          value={filter.priority ?? ANY}
          onValueChange={(v) =>
            onChange({ ...filter, priority: v === ANY ? null : (v as TaskPriority) })
          }
        >
          <SelectTrigger size="sm" className="h-7 flex-1 text-xs" aria-label="Filter by priority">
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
            onValueChange={(v) => onChange({ ...filter, label: v === ANY ? null : v })}
          >
            <SelectTrigger size="sm" className="h-7 flex-1 text-xs" aria-label="Filter by label">
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
      </div>
    </div>
  );
}
