import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Download, ExternalLink, RefreshCw } from "lucide-react";
import { getName } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import type { UpdaterControls, UpdaterState } from "@/hooks/useUpdater";

const RELEASES_URL = "https://github.com/anbturki/docsreader/releases";

interface Props {
  updater: UpdaterState & UpdaterControls;
}

export function AboutSection({ updater }: Props) {
  const [appName, setAppName] = useState("DocsReader");

  useEffect(() => {
    getName()
      .then(setAppName)
      .catch(() => undefined);
  }, []);

  const { phase, currentVersion, pendingVersion, error, lastCheckedAt } = updater;
  const isChecking = phase === "checking";
  const isInstalling = phase === "downloading" || phase === "installing" || phase === "ready-to-relaunch";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
          <Download className="size-6" />
        </div>
        <div>
          <div className="text-base font-semibold">{appName}</div>
          <div className="text-xs text-muted-foreground">
            {currentVersion ? `Version ${currentVersion}` : "Version unknown"}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void updater.checkNow()}
            disabled={isChecking || isInstalling}
            className="self-start"
          >
            <RefreshCw className={`size-4${isChecking ? " animate-spin" : ""}`} />
            {isChecking ? "Checking…" : "Check for updates"}
          </Button>
          {phase === "available" && (
            <Button type="button" onClick={() => void updater.install()} disabled={isInstalling}>
              <Download className="size-4" />
              Install v{pendingVersion}
            </Button>
          )}
        </div>
        <UpdateStatus
          phase={phase}
          pendingVersion={pendingVersion}
          error={error}
          lastCheckedAt={lastCheckedAt}
        />
      </div>

      <button
        type="button"
        onClick={() => void openUrl(RELEASES_URL)}
        className="flex items-center gap-1.5 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ExternalLink className="size-3.5" />
        View release notes on GitHub
      </button>
    </div>
  );
}

function UpdateStatus({
  phase,
  pendingVersion,
  error,
  lastCheckedAt,
}: {
  phase: UpdaterState["phase"];
  pendingVersion?: string;
  error?: string;
  lastCheckedAt?: number;
}) {
  if (phase === "up-to-date") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-[var(--status-success-fg)]">
        <CheckCircle2 className="size-3.5" />
        You're on the latest version.
      </p>
    );
  }
  if (phase === "available") {
    return (
      <p className="text-xs text-muted-foreground">
        Version {pendingVersion} is available to download.
      </p>
    );
  }
  if (phase === "error" && error) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-destructive">
        <AlertCircle className="mt-px size-3.5 shrink-0" />
        <span className="min-w-0 break-words">Couldn't check for updates: {error}</span>
      </p>
    );
  }
  if (lastCheckedAt) {
    return (
      <p className="text-xs text-muted-foreground">
        Last checked {new Date(lastCheckedAt).toLocaleString()}.
      </p>
    );
  }
  return null;
}
