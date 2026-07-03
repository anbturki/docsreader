import { FileText } from "lucide-react";
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
  onTogglePin: (path: string) => void;
}

export function PinnedList({
  files,
  selectedPath,
  onSelect,
  onOpenInNewTab,
  onOpenInOtherPane,
  onTogglePin,
}: Props) {
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
            onOpenInOtherPane={onOpenInOtherPane}
            pinned
            onTogglePin={onTogglePin}
          >
            <button
              {...fileOpenHandlers(f.path, onSelect, onOpenInNewTab)}
              className={cn(
                SIDEBAR_ROW,
                "px-3",
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
  );
}
