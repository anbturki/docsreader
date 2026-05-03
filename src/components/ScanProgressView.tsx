import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ScanProgress } from "../lib/scan";

interface Props {
  progress?: ScanProgress;
  startedAt?: number;
}

export function ScanProgressView({ progress, startedAt }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => {
      setElapsed(performance.now() - startedAt);
    }, 100);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
      <Loader2 className="size-5 animate-spin text-primary" />
      <div className="text-sm font-medium">Scanning directory</div>

      <div className="grid grid-cols-3 gap-2 w-full">
        <Stat value={progress?.filesFound ?? 0} label="files" />
        <Stat value={progress?.dirsVisited ?? 0} label="folders" />
        <Stat value={`${(elapsed / 1000).toFixed(1)}s`} label="elapsed" />
      </div>

      {progress?.currentDir && (
        <div className="flex items-center gap-2 text-xs w-full justify-center">
          <span className="text-muted-foreground">in</span>
          <code
            className="font-mono bg-muted border rounded px-1.5 py-0.5 truncate max-w-full"
            title={progress.currentDir}
          >
            {truncate(progress.currentDir, 48)}
          </code>
        </div>
      )}
      {progress?.lastFile && (
        <div className="flex items-center gap-2 text-xs w-full justify-center">
          <span className="text-muted-foreground">read</span>
          <code
            className="font-mono bg-muted border rounded px-1.5 py-0.5 truncate max-w-full"
            title={progress.lastFile}
          >
            {truncate(progress.lastFile, 48)}
          </code>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col items-center bg-muted border rounded-md px-2 py-1.5">
      <span className="text-base font-semibold tabular-nums text-primary">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const head = Math.floor((max - 1) / 2);
  const tail = max - head - 1;
  return s.slice(0, head) + "…" + s.slice(-tail);
}
