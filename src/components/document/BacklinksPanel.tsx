import { useMemo } from "react";
import type { MarkdownFile } from "@/lib/scan";
import { backlinksFor, groupByFolder } from "@/lib/backlinks";

interface Props {
  files: MarkdownFile[];
  activePath: string;
  onNavigate: (path: string) => void;
}

export function BacklinksPanel({ files, activePath, onNavigate }: Props) {
  const groups = useMemo(
    () => groupByFolder(backlinksFor(files, activePath)),
    [files, activePath]
  );

  if (groups.length === 0) return null;

  return (
    <section className="border-t py-2">
      <h3 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Backlinks
      </h3>
      {groups.map((group) => (
        <div key={group.folder} className="flex flex-col gap-0.5">
          <div className="truncate px-2 pt-1 text-[11px] text-muted-foreground/70">
            {group.folder}
          </div>
          {group.sources.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => onNavigate(file.path)}
              title={file.relPath}
              className="w-full truncate rounded px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-accent"
            >
              {file.title || file.name}
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
