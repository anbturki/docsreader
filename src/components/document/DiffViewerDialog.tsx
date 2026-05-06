import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { computeDiffChanges } from "@/lib/diffStats";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  before: string;
  after: string;
  onReload: () => void;
  onDismiss: () => void;
}

interface DiffLine {
  text: string;
  kind: "context" | "add" | "remove";
}

export function DiffViewerDialog({
  open,
  onOpenChange,
  before,
  after,
  onReload,
  onDismiss,
}: Props) {
  const lines = useMemo(() => buildDiffLines(before, after), [before, after]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="border-b px-5 py-3">
          <DialogTitle className="text-base font-semibold">
            External change diff
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto bg-card font-mono text-[12px] leading-relaxed">
          {lines.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No textual differences. The change was metadata-only.
            </div>
          ) : (
            <pre className="m-0 whitespace-pre">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "px-4 py-px",
                    line.kind === "add" &&
                      "bg-emerald-100/60 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
                    line.kind === "remove" &&
                      "bg-rose-100/60 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                  )}
                >
                  <span className="select-none opacity-50">
                    {line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}
                  </span>
                  <span className="whitespace-pre-wrap break-words">
                    {line.text || " "}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </div>

        <DialogFooter className="border-t px-5 py-3">
          <Button variant="ghost" onClick={onDismiss}>
            Keep current version
          </Button>
          <Button onClick={onReload}>
            <RefreshCw className="size-3.5" />
            Reload from disk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildDiffLines(before: string, after: string): DiffLine[] {
  const changes = computeDiffChanges(before, after);
  const out: DiffLine[] = [];
  for (const change of changes) {
    const value = change.value;
    // Trailing newlines from diffLines produce an empty final entry; trim once.
    const lines = value.endsWith("\n")
      ? value.slice(0, -1).split("\n")
      : value.split("\n");
    for (const line of lines) {
      if (change.added) out.push({ text: line, kind: "add" });
      else if (change.removed) out.push({ text: line, kind: "remove" });
      else out.push({ text: line, kind: "context" });
    }
  }
  return out;
}
