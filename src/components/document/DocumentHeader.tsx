import { Badge } from "@/components/ui/badge";

interface Props {
  title: string;
  tags: string[];
  modified: number | undefined;
}

export function DocumentHeader({ title, tags, modified }: Props) {
  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            #{tag}
          </Badge>
        ))}
        {modified && (
          <span className="text-muted-foreground">
            Modified{" "}
            {new Date(modified * 1000).toLocaleString(undefined, {
              year: "numeric",
              month: "numeric",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </>
  );
}
