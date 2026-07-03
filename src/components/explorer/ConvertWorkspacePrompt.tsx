import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  folderName: string;
  onConvert: () => void;
  onDecline: () => void;
}

export function ConvertWorkspacePrompt({ folderName, onConvert, onDecline }: Props) {
  return (
    <Dialog open onOpenChange={(open) => !open && onDecline()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make “{folderName}” a managed workspace?</DialogTitle>
          <DialogDescription>
            A managed workspace gets a .docsreader.yaml marker and lifecycle
            folders (research, in-progress, done, archived), so AI agents can
            create and organize docs here over MCP. Your existing files are
            not touched. Keep it read-only to just browse the folder as-is.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onDecline}>
            Keep read-only
          </Button>
          <Button onClick={onConvert}>Convert to workspace</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
