import type { KeyboardEventHandler, Ref } from "react";
import { Search } from "lucide-react";
import { SidebarInput } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search names, tags, and contents...",
  label = "Search",
  className,
  ref,
  onKeyDown,
}: Props) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      <SidebarInput
        ref={ref}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="pl-7"
      />
    </div>
  );
}
