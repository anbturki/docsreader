import type { ReactNode } from "react";
import { ClipboardCopy, FilePlus, FolderOpen } from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const REVEAL_LABEL = /Mac/i.test(navigator.platform)
  ? "Reveal in Finder"
  : /Win/i.test(navigator.platform)
    ? "Reveal in Explorer"
    : "Show in Folder";

interface Props {
  path: string;
  isFile: boolean;
  onOpenInNewTab?: (path: string) => void;
  children: ReactNode;
}

export function EntryContextMenu({ path, isFile, onOpenInNewTab, children }: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {isFile && onOpenInNewTab && (
          <>
            <ContextMenuItem onSelect={() => onOpenInNewTab(path)}>
              <FilePlus />
              Open in new tab
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onSelect={() => navigator.clipboard.writeText(path)}>
          <ClipboardCopy />
          Copy path
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => revealItemInDir(path)}>
          <FolderOpen />
          {REVEAL_LABEL}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
