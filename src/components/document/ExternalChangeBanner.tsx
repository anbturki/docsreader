import { useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeDiffStats } from "@/lib/diffStats";
import { DiffViewerDialog } from "./DiffViewerDialog";
import type { DiffViewMode } from "@/lib/storage";

interface Props {
  before: string;
  after: string;
  diffViewMode: DiffViewMode;
  onDiffViewModeChange: (mode: DiffViewMode) => void;
  onReload: () => void;
  onDismiss: () => void;
}

export function ExternalChangeBanner({
  before,
  after,
  diffViewMode,
  onDiffViewModeChange,
  onReload,
  onDismiss,
}: Props) {
  const stats = useMemo(() => computeDiffStats(before, after), [before, after]);
  const [diffOpen, setDiffOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-amber-200 bg-amber-50/95 px-4 py-2 text-sm dark:border-amber-900/60 dark:bg-amber-950/40">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <div className="flex-1 truncate">
            <span className="font-medium text-amber-900 dark:text-amber-200">
              File changed on disk
            </span>
            <span className="ml-2 text-amber-800/70 dark:text-amber-200/70">
              {formatStats(stats)}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setDiffOpen(true)}>
              Show diff
            </Button>
            <Button size="sm" variant="default" onClick={onReload}>
              <RefreshCw className="size-3.5" />
              Reload
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDismiss}
              title="Dismiss"
              aria-label="Dismiss"
              className="size-8"
            >
              <X />
            </Button>
          </div>
        </div>
      </div>
      <DiffViewerDialog
        open={diffOpen}
        onOpenChange={setDiffOpen}
        before={before}
        after={after}
        mode={diffViewMode}
        onModeChange={onDiffViewModeChange}
        onReload={() => {
          setDiffOpen(false);
          onReload();
        }}
        onDismiss={() => {
          setDiffOpen(false);
          onDismiss();
        }}
      />
    </>
  );
}

function formatStats({ added, removed }: { added: number; removed: number }): string {
  const parts: string[] = [];
  if (added) parts.push(`+${added} line${added === 1 ? "" : "s"}`);
  if (removed) parts.push(`-${removed} line${removed === 1 ? "" : "s"}`);
  return parts.length === 0 ? "metadata-only change" : parts.join(", ");
}
