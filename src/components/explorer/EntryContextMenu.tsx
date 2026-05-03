import type { ReactNode } from "react";
import { ClipboardCopy, FolderOpen } from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const REVEAL_LABEL = /Mac/i.test(navigator.platform)
  ? "Reveal in Finder"
  : /Win/i.test(navigator.platform)
    ? "Reveal in Explorer"
    : "Show in Folder";

export function EntryContextMenu({ path, children }: { path: string; children: ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
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
