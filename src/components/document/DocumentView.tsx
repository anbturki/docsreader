import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarkdownFile } from "@/lib/scan";
import { splitFrontmatter } from "@/lib/scan";
import type { ViewSettings } from "@/lib/storage";
import type { Tab } from "@/hooks/useTabs";
import { MarkdownViewer } from "@/components/viewer/MarkdownViewer";
import { Button } from "@/components/ui/button";
import { DocumentHeader } from "./DocumentHeader";
import { Frontmatter } from "./Frontmatter";
import { TaskHeader } from "./TaskHeader";
import type { CrepeEditorHandle } from "./CrepeEditor";

// The editor bundles ProseMirror + CodeMirror; keep it off the reader's
// initial load path since most sessions never enter edit mode.
const CrepeEditor = lazy(() =>
  import("./CrepeEditor").then((m) => ({ default: m.CrepeEditor }))
);

interface Props {
  tab: Tab;
  file: MarkdownFile | undefined;
  rootPath: string | undefined;
  viewSettings: ViewSettings;
  onNavigate: (path: string) => void;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (markdown: string) => Promise<void>;
  onToggleTask: (index: number) => void;
}

export function DocumentView({
  tab,
  file,
  rootPath,
  viewSettings,
  onNavigate,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleTask,
}: Props) {
  const title = file?.title || file?.name || tab.title;
  const tags = file?.tags ?? [];
  const modified = file?.modified;
  const editing = tab.draft !== undefined;
  const editable = !tab.loading && !tab.error && !editing;

  const editorRef = useRef<CrepeEditorHandle>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setEditorReady(false);
      setSaving(false);
    }
  }, [editing]);

  const handleSave = useCallback(async () => {
    const result = editorRef.current?.getResult();
    if (!result) return;
    if (!result.dirty) {
      onCancelEdit();
      return;
    }
    setSaving(true);
    try {
      await onSaveEdit(result.markdown);
    } finally {
      setSaving(false);
    }
  }, [onCancelEdit, onSaveEdit]);

  return (
    <article
      className={cn(
        "px-10 pt-6 pb-16",
        viewSettings.width === "full" ? "w-full" : "max-w-4xl mx-auto"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <DocumentHeader title={title} tags={tags} modified={modified} />
          <TaskHeader
            meta={tab.meta}
            relPath={file?.relPath ?? tab.path}
            content={tab.content}
          />
        </div>
        {editing ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSave()}
              disabled={!editorReady || saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancelEdit}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        ) : (
          editable && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Edit document"
              title="Edit document"
              onClick={onBeginEdit}
            >
              <Pencil className="size-4" />
            </Button>
          )
        )}
      </div>
      {tab.draftError && <p className="mt-2 text-xs text-destructive">{tab.draftError}</p>}
      <Frontmatter data={tab.meta} />
      <div className="mt-6">
        {tab.loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tab.error ? (
          <p className="text-sm text-destructive">{tab.error}</p>
        ) : editing ? (
          <Suspense
            fallback={<p className="text-sm text-muted-foreground">Loading editor…</p>}
          >
            <CrepeEditor
              ref={editorRef}
              initialMarkdown={splitFrontmatter(tab.draft ?? "").body}
              fontSize={viewSettings.fontSize}
              onRequestSave={handleSave}
              onCancel={onCancelEdit}
              onReadyChange={setEditorReady}
            />
          </Suspense>
        ) : (
          <MarkdownViewer
            content={tab.content}
            fontFamily={viewSettings.fontFamily}
            fontSize={viewSettings.fontSize}
            codeThemeLight={viewSettings.codeThemeLight}
            codeThemeDark={viewSettings.codeThemeDark}
            currentFilePath={tab.path}
            rootPath={rootPath}
            onNavigate={onNavigate}
            onToggleTask={onToggleTask}
          />
        )}
      </div>
    </article>
  );
}
