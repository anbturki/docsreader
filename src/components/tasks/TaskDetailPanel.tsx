import { useCallback, useEffect, useState } from "react";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { Maximize2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MarkdownViewer } from "@/components/viewer/MarkdownViewer";
import { TaskHeader } from "@/components/document/TaskHeader";
import { parseFrontmatter } from "@/lib/scan";
import { toggleTaskCheckbox } from "@/lib/checklist";
import type { ViewSettings } from "@/lib/storage";

interface Props {
  path: string;
  rootPath: string | undefined;
  viewSettings: ViewSettings;
  // Bumped when the workspace is refreshed or a task is written, so an open
  // detail re-reads rather than showing a stale body.
  reloadSignal: number;
  onOpenFull: (path: string) => void;
  onNavigate: (absolutePath: string) => void;
  // A checkbox toggle wrote the file; let the list refresh its progress.
  onChanged: () => void;
  onClose: () => void;
}

interface Loaded {
  meta: Record<string, unknown>;
  body: string;
  title: string;
}

function basenameTitle(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? path;
  return name.replace(/\.mdx?$/i, "");
}

export function TaskDetailPanel({
  path,
  rootPath,
  viewSettings,
  reloadSignal,
  onOpenFull,
  onNavigate,
  onChanged,
  onClose,
}: Props) {
  const [loaded, setLoaded] = useState<Loaded | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { data, content } = parseFrontmatter(await readTextFile(path));
        if (cancelled) return;
        const title =
          typeof data.title === "string" && data.title.trim() ? data.title : basenameTitle(path);
        setLoaded({ meta: data, body: content, title });
        setError(undefined);
      } catch (e) {
        if (!cancelled) {
          setLoaded(undefined);
          setError(String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, reloadSignal, reloadKey]);

  const handleToggle = useCallback(
    async (index: number) => {
      try {
        const next = toggleTaskCheckbox(await readTextFile(path), index);
        if (next === null) return;
        await writeTextFile(path, next);
        setReloadKey((k) => k + 1);
        onChanged();
      } catch (e) {
        setError(String(e));
      }
    },
    [path, onChanged]
  );

  return (
    <div className="flex h-full min-h-0 flex-col" data-slot="task-detail">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">
            {loaded?.title ?? basenameTitle(path)}
          </h2>
          {loaded && <TaskHeader meta={loaded.meta} relPath={path} content={loaded.body} />}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            onClick={() => onOpenFull(path)}
            title="Open full"
            aria-label="Open full"
          >
            <Maximize2 className="size-3.5" />
            Open
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground"
            onClick={onClose}
            title="Hide details"
            aria-label="Hide details"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        {loading && !loaded ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : loaded ? (
          <MarkdownViewer
            content={loaded.body}
            fontFamily={viewSettings.fontFamily}
            fontSize={viewSettings.fontSize}
            codeThemeLight={viewSettings.codeThemeLight}
            codeThemeDark={viewSettings.codeThemeDark}
            currentFilePath={path}
            rootPath={rootPath}
            onNavigate={onNavigate}
            onToggleTask={handleToggle}
          />
        ) : null}
      </div>
    </div>
  );
}
