import { useMemo } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarkdownFile } from "@/lib/scan";
import { EntryContextMenu } from "./EntryContextMenu";

interface Props {
  files: MarkdownFile[];
  selectedPath: string | undefined;
  onSelect: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
  isPinned: (path: string) => boolean;
  onTogglePin: (path: string) => void;
}

interface Bucket {
  label: string;
  files: MarkdownFile[];
}

function bucketize(files: MarkdownFile[]): Bucket[] {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const yesterdayMs = todayMs - 86_400_000;
  const weekMs = todayMs - 6 * 86_400_000;
  const monthMs = todayMs - 29 * 86_400_000;

  const today: MarkdownFile[] = [];
  const yesterday: MarkdownFile[] = [];
  const week: MarkdownFile[] = [];
  const month: MarkdownFile[] = [];
  const older: MarkdownFile[] = [];

  const sorted = [...files].sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0));
  for (const f of sorted) {
    const m = f.modified;
    if (m == null || m > now) {
      older.push(f);
      continue;
    }
    if (m >= todayMs) today.push(f);
    else if (m >= yesterdayMs) yesterday.push(f);
    else if (m >= weekMs) week.push(f);
    else if (m >= monthMs) month.push(f);
    else older.push(f);
  }

  const out: Bucket[] = [];
  if (today.length) out.push({ label: "Today", files: today });
  if (yesterday.length) out.push({ label: "Yesterday", files: yesterday });
  if (week.length) out.push({ label: "Earlier this week", files: week });
  if (month.length) out.push({ label: "This month", files: month });
  if (older.length) out.push({ label: "Older", files: older });
  return out;
}

export function RecentList({
  files,
  selectedPath,
  onSelect,
  onOpenInNewTab,
  onOpenInOtherPane,
  isPinned,
  onTogglePin,
}: Props) {
  const buckets = useMemo(() => bucketize(files), [files]);

  if (files.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">No files yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      {buckets.map((b) => (
        <section key={b.label}>
          <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {b.label}
          </div>
          <ul>
            {b.files.map((f) => (
              <FileRow
                key={f.path}
                file={f}
                selected={f.path === selectedPath}
                onSelect={onSelect}
                onOpenInNewTab={onOpenInNewTab}
                onOpenInOtherPane={onOpenInOtherPane}
                pinned={isPinned(f.path)}
                onTogglePin={onTogglePin}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface RowProps {
  file: MarkdownFile;
  selected: boolean;
  onSelect: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
  pinned: boolean;
  onTogglePin: (path: string) => void;
}

function FileRow({
  file,
  selected,
  onSelect,
  onOpenInNewTab,
  onOpenInOtherPane,
  pinned,
  onTogglePin,
}: RowProps) {
  return (
    <li>
      <EntryContextMenu
        path={file.path}
        isFile
        onOpenInNewTab={onOpenInNewTab}
        onOpenInOtherPane={onOpenInOtherPane}
        pinned={pinned}
        onTogglePin={onTogglePin}
      >
        <button
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey) {
              e.preventDefault();
              onOpenInNewTab(file.path);
              return;
            }
            onSelect(file.path);
          }}
          onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              onOpenInNewTab(file.path);
            }
          }}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
            selected
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "hover:bg-sidebar-accent/50"
          )}
          title={file.relPath}
        >
          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{file.title || file.name}</span>
        </button>
      </EntryContextMenu>
    </li>
  );
}
