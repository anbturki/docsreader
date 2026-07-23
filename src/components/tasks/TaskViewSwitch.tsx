import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isTaskTabView, TASK_TAB_VIEWS, type TaskTabView } from "@/lib/storage";
import { TASK_VIEWS } from "./taskViews";

interface Props {
  view: TaskTabView;
  onChange: (view: TaskTabView) => void;
}

// Sized like the split control beside it, so the bar keeps its height as this
// one comes and goes with the active tab.
export function TaskViewSwitch({ view, onChange }: Props) {
  return (
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={(next) => {
        if (isTaskTabView(next)) onChange(next);
      }}
      variant="outline"
      spacing={0}
      aria-label="Tasks view"
      className="mx-1"
    >
      {TASK_TAB_VIEWS.map((id) => {
        const { label, icon: Icon } = TASK_VIEWS[id];
        return (
          <ToggleGroupItem key={id} value={id} className="size-6" title={label} aria-label={label}>
            <Icon className="size-3.5" />
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
