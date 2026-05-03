import { cn } from "@/lib/utils";
import type { MarkdownFile } from "@/lib/scan";
import type { ViewSettings } from "@/lib/storage";
import { MarkdownViewer } from "@/components/viewer/MarkdownViewer";
import { DocumentHeader } from "./DocumentHeader";
import { Frontmatter } from "./Frontmatter";

interface Props {
  file: MarkdownFile;
  content: string;
  meta: Record<string, unknown>;
  loading: boolean;
  error: string | undefined;
  rootPath: string | undefined;
  viewSettings: ViewSettings;
  onNavigate: (path: string) => void;
}

export function DocumentView({
  file,
  content,
  meta,
  loading,
  error,
  rootPath,
  viewSettings,
  onNavigate,
}: Props) {
  return (
    <article
      className={cn(
        "px-10 pt-6 pb-16",
        viewSettings.width === "full" ? "w-full" : "max-w-4xl mx-auto"
      )}
    >
      <DocumentHeader file={file} />
      <Frontmatter data={meta} />
      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <MarkdownViewer
            content={content}
            fontFamily={viewSettings.fontFamily}
            fontSize={viewSettings.fontSize}
            currentFilePath={file.path}
            rootPath={rootPath}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </article>
  );
}
