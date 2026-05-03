import { Search } from "lucide-react";
import { SidebarInput } from "@/components/ui/sidebar";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput({ value, onChange }: Props) {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      <SidebarInput
        placeholder="Search files, titles, tags..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-7"
      />
    </div>
  );
}
