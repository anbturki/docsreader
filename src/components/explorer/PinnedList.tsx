import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarkdownFile } from "@/lib/scan";
import { EntryContextMenu } from "./EntryContextMenu";

interface Props {
  files: MarkdownFile[];
  selectedPath: string | undefined;
  onSelect: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onTogglePin: (path: string) => void;
}

export function PinnedList({ files, selectedPath, onSelect, onOpenInNewTab, onTogglePin }: Props) {
  if (files.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-muted-foreground">
        Right-click any file and choose Pin to keep it here.
      </p>
    );
  }

  return (
    <ul className="py-2">
      {files.map((f) => (
        <li key={f.path}>
          <EntryContextMenu
            path={f.path}
            isFile
            onOpenInNewTab={onOpenInNewTab}
            pinned
            onTogglePin={onTogglePin}
          >
            <button
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) {
                  e.preventDefault();
                  onOpenInNewTab(f.path);
                  return;
                }
                onSelect(f.path);
              }}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  onOpenInNewTab(f.path);
                }
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                f.path === selectedPath
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent/50"
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
  );
}
