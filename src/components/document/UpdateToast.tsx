import { Download, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UpdaterPhase } from "@/hooks/useUpdater";

interface Props {
  phase: UpdaterPhase;
  pendingVersion?: string;
  currentVersion?: string;
  progressBytes?: number;
  totalBytes?: number;
  onInstall: () => void;
  onDismiss: () => void;
}

const VISIBLE_PHASES: readonly UpdaterPhase[] = [
  "available",
  "downloading",
  "installing",
  "ready-to-relaunch",
];

export function UpdateToast({
  phase,
  pendingVersion,
  currentVersion,
  progressBytes,
  totalBytes,
  onInstall,
  onDismiss,
}: Props) {
  if (!VISIBLE_PHASES.includes(phase)) return null;

  const isBusy = phase === "downloading" || phase === "installing";
  const isRelaunching = phase === "ready-to-relaunch";
  const percent = downloadPercent(progressBytes, totalBytes);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="border bg-popover text-popover-foreground shadow-md">
        <div className="flex items-center gap-2 px-2.5 py-2">
          <Download className="size-3.5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight">{title(phase)}</p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {subtitle(phase, pendingVersion, currentVersion)}
            </p>
          </div>
          {phase === "available" && (
            <button
              type="button"
              onClick={onDismiss}
              title="Dismiss until next version"
              aria-label="Dismiss"
              className="-mr-1 shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {phase === "downloading" && (
          <div className="h-1 overflow-hidden bg-muted">
            <div
              className={`h-full bg-primary transition-all duration-300 ${percent === null ? "w-1/3 animate-pulse" : ""}`}
              style={percent === null ? undefined : { width: `${percent}%` }}
            />
          </div>
        )}

        <div className="flex items-center gap-1.5 border-t px-2.5 py-2">
          <Button
            size="sm"
            className="h-7 flex-1 rounded-none px-2 text-xs"
            onClick={onInstall}
            disabled={isBusy || isRelaunching}
          >
            <RefreshCw className={`size-3.5${isBusy || isRelaunching ? " animate-spin" : ""}`} />
            {phase === "downloading"
              ? percent === null
                ? "Downloading…"
                : `Downloading ${percent}%`
              : phase === "installing"
                ? "Installing…"
                : isRelaunching
                  ? "Restarting…"
                  : "Install and relaunch"}
          </Button>
          {phase === "available" && (
            <Button size="sm" variant="ghost" className="h-7 rounded-none px-2 text-xs" onClick={onDismiss}>
              Later
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function title(phase: UpdaterPhase): string {
  if (phase === "ready-to-relaunch") return "Restarting DocsReader";
  if (phase === "installing") return "Installing update";
  if (phase === "downloading") return "Downloading update";
  return "Update available";
}

function subtitle(phase: UpdaterPhase, pendingVersion?: string, currentVersion?: string): string {
  if (phase === "ready-to-relaunch") return "The app will reopen in a moment.";
  if (phase === "downloading" || phase === "installing") {
    return pendingVersion ? `DocsReader ${pendingVersion}` : "Please wait…";
  }
  const target = pendingVersion ? `DocsReader ${pendingVersion}` : "A new version";
  return currentVersion ? `${target} · you're on v${currentVersion}` : `${target} is ready to install`;
}

function downloadPercent(progressBytes?: number, totalBytes?: number): number | null {
  if (!totalBytes) return null;
  return Math.min(100, Math.round(((progressBytes ?? 0) / totalBytes) * 100));
}
