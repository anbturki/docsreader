import type { ReactNode } from "react";
import { ClipboardCopy, Columns2, EyeOff, FilePlus, FolderOpen, GitCompare, Pin, PinOff } from "lucide-react";
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
  onOpenInOtherPane?: (path: string) => void;
  pinned?: boolean;
  onTogglePin?: (path: string) => void;
  onHide?: (path: string) => void;
  onShowGitDiff?: (path: string) => void;
  children: ReactNode;
}

export function EntryContextMenu({
  path,
  isFile,
  onOpenInNewTab,
  onOpenInOtherPane,
  pinned,
  onTogglePin,
  onHide,
  onShowGitDiff,
  children,
}: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {isFile && onOpenInNewTab && (
          <ContextMenuItem onSelect={() => onOpenInNewTab(path)}>
            <FilePlus />
            Open in new tab
          </ContextMenuItem>
        )}
        {isFile && onOpenInOtherPane && (
          <ContextMenuItem onSelect={() => onOpenInOtherPane(path)}>
            <Columns2 />
            Open in other pane
          </ContextMenuItem>
        )}
        {isFile && (onOpenInNewTab || onOpenInOtherPane) && <ContextMenuSeparator />}
        {isFile && onTogglePin && (
          <ContextMenuItem onSelect={() => onTogglePin(path)}>
            {pinned ? (
              <>
                <PinOff />
                Unpin
              </>
            ) : (
              <>
                <Pin />
                Pin to top
              </>
            )}
          </ContextMenuItem>
        )}
        {onHide && (
          <ContextMenuItem onSelect={() => onHide(path)}>
            <EyeOff />
            Hide from explorer
          </ContextMenuItem>
        )}
        {(isFile || onHide) && <ContextMenuSeparator />}
        {isFile && onShowGitDiff && (
          <>
            <ContextMenuItem onSelect={() => onShowGitDiff(path)}>
              <GitCompare />
              Show git diff
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
