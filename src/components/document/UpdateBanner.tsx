import { Download, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UpdaterPhase } from "@/hooks/useUpdater";

interface Props {
  phase: UpdaterPhase;
  pendingVersion?: string;
  currentVersion?: string;
  progressBytes?: number;
  totalBytes?: number;
  error?: string;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({
  phase,
  pendingVersion,
  currentVersion,
  progressBytes,
  totalBytes,
  error,
  onInstall,
  onDismiss,
}: Props) {
  if (phase === "idle" || phase === "error") return null;

  const isBusy = phase === "downloading" || phase === "installing";
  const progressLabel = formatProgress(phase, progressBytes, totalBytes);

  return (
    <div className="sticky top-0 z-10 border-b border-sky-200 bg-sky-50/95 px-4 py-2 text-sm dark:border-sky-900/60 dark:bg-sky-950/40">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <Download className="size-4 shrink-0 text-sky-600 dark:text-sky-500" />
        <div className="flex-1 truncate">
          <span className="font-medium text-sky-900 dark:text-sky-200">
            {phase === "ready-to-relaunch"
              ? "Restarting to apply update…"
              : `DocsReader ${pendingVersion ?? ""} is available`}
          </span>
          {currentVersion && phase === "available" ? (
            <span className="ml-2 text-sky-800/70 dark:text-sky-200/70">
              You're on v{currentVersion}
            </span>
          ) : null}
          {progressLabel ? (
            <span className="ml-2 text-sky-800/70 dark:text-sky-200/70">{progressLabel}</span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="default" onClick={onInstall} disabled={isBusy || phase === "ready-to-relaunch"}>
            <RefreshCw className={`size-3.5${isBusy ? " animate-spin" : ""}`} />
            {phase === "downloading" ? "Downloading…" : phase === "installing" ? "Installing…" : "Install and relaunch"}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDismiss}
            disabled={isBusy || phase === "ready-to-relaunch"}
            title="Dismiss until next version"
            aria-label="Dismiss"
            className="size-8"
          >
            <X />
          </Button>
        </div>
      </div>
      {error ? (
        <p className="mx-auto mt-1 max-w-3xl text-xs text-sky-800/70 dark:text-sky-200/70">{error}</p>
      ) : null}
    </div>
  );
}

function formatProgress(
  phase: UpdaterPhase,
  progressBytes?: number,
  totalBytes?: number
): string {
  if (phase !== "downloading") return "";
  if (!totalBytes) {
    if (!progressBytes) return "";
    return `${formatBytes(progressBytes)} downloaded`;
  }
  const pct = Math.min(100, Math.round(((progressBytes ?? 0) / totalBytes) * 100));
  return `${pct}% (${formatBytes(progressBytes ?? 0)} / ${formatBytes(totalBytes)})`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
