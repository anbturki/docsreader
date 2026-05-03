import { Badge } from "@/components/ui/badge";
import type { MarkdownFile } from "@/lib/scan";

interface Props {
  file: MarkdownFile;
}

export function DocumentHeader({ file }: Props) {
  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight">
        {file.title || file.name}
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {file.tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            #{tag}
          </Badge>
        ))}
        {file.modified && (
          <span className="text-muted-foreground">
            Modified {new Date(file.modified * 1000).toLocaleDateString()}
          </span>
        )}
      </div>
    </>
  );
}
