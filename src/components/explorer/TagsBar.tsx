import { Badge } from "@/components/ui/badge";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";

const MAX_TAGS = 32;

interface Props {
  tags: string[];
  activeTag: string;
  onTagClick: (tag: string) => void;
}

export function TagsBar({ tags, activeTag, onTagClick }: Props) {
  if (tags.length === 0) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Tags</SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="flex flex-wrap gap-1 px-2">
          {tags.slice(0, MAX_TAGS).map((tag) => {
            const active = activeTag.toLowerCase() === tag.toLowerCase();
            return (
              <Badge
                key={tag}
                variant={active ? "default" : "secondary"}
                className="cursor-pointer"
                onClick={() => onTagClick(tag)}
              >
                #{tag}
              </Badge>
            );
          })}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
