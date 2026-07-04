import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarkdownFile } from "@/lib/scan";
import type { ViewSettings } from "@/lib/storage";
import type { Tab } from "@/hooks/useTabs";
import { MarkdownViewer } from "@/components/viewer/MarkdownViewer";
import { Button } from "@/components/ui/button";
import { DocumentHeader } from "./DocumentHeader";
import { Frontmatter } from "./Frontmatter";
import { QuickEditor } from "./QuickEditor";
import { TaskHeader } from "./TaskHeader";

interface Props {
  tab: Tab;
  file: MarkdownFile | undefined;
  rootPath: string | undefined;
  viewSettings: ViewSettings;
  onNavigate: (path: string) => void;
  onBeginEdit: () => void;
  onDraftChange: (value: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => Promise<void>;
  onToggleTask: (index: number) => void;
}

export function DocumentView({
  tab,
  file,
  rootPath,
  viewSettings,
  onNavigate,
  onBeginEdit,
  onDraftChange,
  onCancelEdit,
  onSaveEdit,
  onToggleTask,
}: Props) {
  const title = file?.title || file?.name || tab.title;
  const tags = file?.tags ?? [];
  const modified = file?.modified;
  const editing = tab.draft !== undefined;
  const editable = !tab.loading && !tab.error && !editing;

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
          {!editing && (
            <TaskHeader
              meta={tab.meta}
              relPath={file?.relPath ?? tab.path}
              content={tab.content}
            />
          )}
        </div>
        {editable && (
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
        )}
      </div>
      {!editing && tab.draftError && (
        <p className="mt-2 text-xs text-destructive">{tab.draftError}</p>
      )}
      {!editing && <Frontmatter data={tab.meta} />}
      <div className="mt-6">
        {tab.loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tab.error ? (
          <p className="text-sm text-destructive">{tab.error}</p>
        ) : editing ? (
          <QuickEditor
            value={tab.draft ?? ""}
            error={tab.draftError}
            onChange={onDraftChange}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
          />
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
