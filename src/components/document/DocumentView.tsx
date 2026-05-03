import { cn } from "@/lib/utils";
import type { MarkdownFile } from "@/lib/scan";
import type { ViewSettings } from "@/lib/storage";
import type { Tab } from "@/hooks/useTabs";
import { MarkdownViewer } from "@/components/viewer/MarkdownViewer";
import { DocumentHeader } from "./DocumentHeader";
import { Frontmatter } from "./Frontmatter";

interface Props {
  tab: Tab;
  file: MarkdownFile | undefined;
  rootPath: string | undefined;
  viewSettings: ViewSettings;
  onNavigate: (path: string) => void;
}

export function DocumentView({ tab, file, rootPath, viewSettings, onNavigate }: Props) {
  const title = file?.title || file?.name || tab.title;
  const tags = file?.tags ?? [];
  const modified = file?.modified;

  return (
    <article
      className={cn(
        "px-10 pt-6 pb-16",
        viewSettings.width === "full" ? "w-full" : "max-w-4xl mx-auto"
      )}
    >
      <DocumentHeader title={title} tags={tags} modified={modified} />
      <Frontmatter data={tab.meta} />
      <div className="mt-6">
        {tab.loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tab.error ? (
          <p className="text-sm text-destructive">{tab.error}</p>
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
          />
        )}
      </div>
    </article>
  );
}
