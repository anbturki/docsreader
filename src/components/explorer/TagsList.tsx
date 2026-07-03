import { useMemo, useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarkdownFile } from "@/lib/scan";
import { EntryContextMenu } from "./EntryContextMenu";
import { SIDEBAR_ROW, sidebarRowState, fileOpenHandlers } from "./sidebarRow";

interface Props {
  files: MarkdownFile[];
  selectedPath: string | undefined;
  onSelect: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
  isPinned: (path: string) => boolean;
  onTogglePin: (path: string) => void;
}

export function TagsList({
  files,
  selectedPath,
  onSelect,
  onOpenInNewTab,
  onOpenInOtherPane,
  isPinned,
  onTogglePin,
}: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, MarkdownFile[]>();
    const untagged: MarkdownFile[] = [];
    for (const f of files) {
      if (f.tags.length === 0) {
        untagged.push(f);
        continue;
      }
      for (const tag of f.tags) {
        const list = map.get(tag);
        if (list) list.push(f);
        else map.set(tag, [f]);
      }
    }
    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    return { sorted, untagged };
  }, [files]);

  if (groups.sorted.length === 0 && groups.untagged.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">No files yet.</p>;
  }

  if (groups.sorted.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-muted-foreground">
        No tags found. Add YAML frontmatter with a tags field.
      </p>
    );
  }

  return (
    <div className="flex flex-col py-2">
      {groups.sorted.map(([tag, list]) => (
        <TagGroup
          key={tag}
          tag={tag}
          files={list}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onOpenInNewTab={onOpenInNewTab}
          onOpenInOtherPane={onOpenInOtherPane}
          isPinned={isPinned}
          onTogglePin={onTogglePin}
        />
      ))}
      {groups.untagged.length > 0 && (
        <TagGroup
          tag="untagged"
          files={groups.untagged}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onOpenInNewTab={onOpenInNewTab}
          onOpenInOtherPane={onOpenInOtherPane}
          isPinned={isPinned}
          onTogglePin={onTogglePin}
          defaultOpen={false}
        />
      )}
    </div>
  );
}

interface GroupProps {
  tag: string;
  files: MarkdownFile[];
  selectedPath: string | undefined;
  onSelect: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
  isPinned: (path: string) => boolean;
  onTogglePin: (path: string) => void;
  defaultOpen?: boolean;
}

function TagGroup({
  tag,
  files,
  selectedPath,
  onSelect,
  onOpenInNewTab,
  onOpenInOtherPane,
  isPinned,
  onTogglePin,
  defaultOpen = true,
}: GroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(SIDEBAR_ROW, "px-3 text-muted-foreground hover:text-foreground")}
        aria-expanded={open}
      >
        <ChevronRight
          className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")}
        />
        <span className="font-medium">#{tag}</span>
        <span className="text-xs">{files.length}</span>
      </button>
      {open && (
        <ul>
          {files.map((f) => (
            <li key={f.path}>
              <EntryContextMenu
                path={f.path}
                isFile
                onOpenInNewTab={onOpenInNewTab}
                onOpenInOtherPane={onOpenInOtherPane}
                pinned={isPinned(f.path)}
                onTogglePin={onTogglePin}
              >
                <button
                  {...fileOpenHandlers(f.path, onSelect, onOpenInNewTab)}
                  className={cn(
                    SIDEBAR_ROW,
                    "px-3 pl-8",
                    sidebarRowState(f.path === selectedPath)
                  )}
                  title={f.relPath}
                >
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{f.title || f.name}</span>
                </button>
              </EntryContextMenu>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
