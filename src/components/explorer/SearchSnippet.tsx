import type { LineMatch } from "@/lib/contentSearch";

interface Props {
  match: LineMatch;
}

/**
 * Renders a matched line from pre-split segments. The backend does the
 * splitting because Rust byte offsets and JavaScript UTF-16 indices disagree on
 * any document containing an accent or an emoji, and because rendering text
 * nodes keeps the snippet free of injected markup.
 */
export function SearchSnippet({ match }: Props) {
  return (
    <div className="flex gap-2 text-xs leading-relaxed">
      <span className="shrink-0 tabular-nums text-muted-foreground/70">{match.line}</span>
      <p className="min-w-0 truncate text-muted-foreground">
        {match.leadingEllipsis && "…"}
        {match.segments.map((segment, index) =>
          segment.isMatch ? (
            <mark
              key={index}
              className="rounded-[2px] bg-primary/25 text-foreground"
            >
              {segment.text}
            </mark>
          ) : (
            <span key={index}>{segment.text}</span>
          )
        )}
        {match.trailingEllipsis && "…"}
      </p>
    </div>
  );
}
