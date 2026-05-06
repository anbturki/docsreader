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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { computeDiffChanges, diffSingleLine, type WordSegment } from "@/lib/diffStats";
import { cn } from "@/lib/utils";
import type { DiffViewMode } from "@/lib/storage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  before: string;
  after: string;
  mode: DiffViewMode;
  onModeChange: (mode: DiffViewMode) => void;
  onReload: () => void;
  onDismiss: () => void;
}

interface DiffLine {
  kind: "context" | "add" | "remove";
  segments: WordSegment[];
}

interface DiffRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

export function DiffViewerDialog({
  open,
  onOpenChange,
  before,
  after,
  mode,
  onModeChange,
  onReload,
  onDismiss,
}: Props) {
  const { unified, split } = useMemo(() => {
    const lines = buildDiffLines(before, after);
    return { unified: lines, split: pairForSplit(lines) };
  }, [before, after]);

  const isEmpty = unified.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b px-5 py-3">
          <DialogTitle className="text-base font-semibold">
            External change diff
          </DialogTitle>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && onModeChange(v as DiffViewMode)}
            variant="outline"
            spacing={4}
          >
            <ToggleGroupItem value="unified" className="h-7 px-2 text-xs">
              Unified
            </ToggleGroupItem>
            <ToggleGroupItem value="split" className="h-7 px-2 text-xs">
              Side by side
            </ToggleGroupItem>
          </ToggleGroup>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto bg-card font-mono text-[12px] leading-relaxed">
          {isEmpty ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No textual differences. The change was metadata-only.
            </div>
          ) : mode === "split" ? (
            <SplitView rows={split} />
          ) : (
            <UnifiedView lines={unified} />
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

function UnifiedView({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="m-0 whitespace-pre">
      {lines.map((line, idx) => (
        <LineRow key={idx} line={line} prefixed />
      ))}
    </div>
  );
}

function SplitView({ rows }: { rows: DiffRow[] }) {
  return (
    <div className="grid grid-cols-2 divide-x">
      <div className="m-0 whitespace-pre">
        {rows.map((row, idx) =>
          row.left ? (
            <LineRow key={`l-${idx}`} line={row.left} />
          ) : (
            <div key={`l-${idx}`} className="bg-muted/30 px-4 py-px opacity-50">
              &nbsp;
            </div>
          )
        )}
      </div>
      <div className="m-0 whitespace-pre">
        {rows.map((row, idx) =>
          row.right ? (
            <LineRow key={`r-${idx}`} line={row.right} />
          ) : (
            <div key={`r-${idx}`} className="bg-muted/30 px-4 py-px opacity-50">
              &nbsp;
            </div>
          )
        )}
      </div>
    </div>
  );
}

function LineRow({ line, prefixed = false }: { line: DiffLine; prefixed?: boolean }) {
  const cls = cn(
    "px-4 py-px",
    line.kind === "add" &&
      "bg-emerald-100/60 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
    line.kind === "remove" &&
      "bg-rose-100/60 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
  );
  const segCls = (s: WordSegment): string => {
    if (!s.changed) return "";
    if (line.kind === "add")
      return "rounded-sm bg-emerald-300/50 dark:bg-emerald-700/50";
    if (line.kind === "remove")
      return "rounded-sm bg-rose-300/50 dark:bg-rose-700/50";
    return "";
  };
  return (
    <div className={cls}>
      {prefixed && (
        <span className="select-none opacity-50">
          {line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}
        </span>
      )}
      <span className="whitespace-pre-wrap break-words">
        {line.segments.length === 0 ? (
          " "
        ) : (
          line.segments.map((s, i) => (
            <span key={i} className={segCls(s)}>
              {s.text}
            </span>
          ))
        )}
      </span>
    </div>
  );
}

function buildDiffLines(before: string, after: string): DiffLine[] {
  const changes = computeDiffChanges(before, after);
  const out: DiffLine[] = [];

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const next = changes[i + 1];
    // Collapse a single-line remove + single-line add into a paired
    // word-diff so the user sees what specifically changed inside the
    // line, not just "this whole line was deleted and a different one
    // added."
    if (
      change.removed &&
      next?.added &&
      isSingleLine(change.value) &&
      isSingleLine(next.value)
    ) {
      const removedLine = stripTrailingNewline(change.value);
      const addedLine = stripTrailingNewline(next.value);
      const { removed, added } = diffSingleLine(removedLine, addedLine);
      out.push({ kind: "remove", segments: removed });
      out.push({ kind: "add", segments: added });
      i++; // consume `next`
      continue;
    }
    const lines = splitLines(change.value);
    for (const line of lines) {
      const segments: WordSegment[] = line ? [{ text: line, changed: false }] : [];
      if (change.added) out.push({ kind: "add", segments });
      else if (change.removed) out.push({ kind: "remove", segments });
      else out.push({ kind: "context", segments });
    }
  }

  return out;
}

function pairForSplit(lines: DiffLine[]): DiffRow[] {
  const rows: DiffRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.kind === "context") {
      rows.push({ left: line, right: line });
      i++;
      continue;
    }
    // Collect a hunk of contiguous removes + adds.
    const removes: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (i < lines.length && lines[i].kind === "remove") {
      removes.push(lines[i]);
      i++;
    }
    while (i < lines.length && lines[i].kind === "add") {
      adds.push(lines[i]);
      i++;
    }
    const max = Math.max(removes.length, adds.length);
    for (let j = 0; j < max; j++) {
      rows.push({ left: removes[j] ?? null, right: adds[j] ?? null });
    }
  }
  return rows;
}

function splitLines(value: string): string[] {
  return value.endsWith("\n")
    ? value.slice(0, -1).split("\n")
    : value.split("\n");
}

function stripTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value.slice(0, -1) : value;
}

function isSingleLine(value: string): boolean {
  const stripped = stripTrailingNewline(value);
  return !stripped.includes("\n");
}
