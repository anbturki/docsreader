import type { KeyboardEventHandler, Ref } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { COMPACT_CONTROL } from "./controlHeight";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}

// A compact search input: the magnifier and the shared control height in one
// place, so every dense header search looks and sizes the same.
export function SearchField({
  value,
  onChange,
  placeholder = "Search...",
  label = "Search",
  className,
  ref,
  onKeyDown,
}: Props) {
  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={ref}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className={cn(COMPACT_CONTROL, "pl-7 text-xs")}
      />
    </div>
  );
}
