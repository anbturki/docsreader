import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { extractOutline } from "@/lib/outline";

interface Props {
  content: string;
  scrollContainer: HTMLElement | null;
}

export function OutlinePanel({ content, scrollContainer }: Props) {
  const headings = useMemo(() => extractOutline(content), [content]);
  const [activeId, setActiveId] = useState<string | undefined>();

  useEffect(() => {
    if (!scrollContainer || headings.length === 0) {
      setActiveId(undefined);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { root: scrollContainer, rootMargin: "0px 0px -70% 0px", threshold: 0 }
    );
    const elements = headings
      .map((h) => scrollContainer.querySelector<HTMLElement>(`#${CSS.escape(h.id)}`))
      .filter((el): el is HTMLElement => !!el);
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings, scrollContainer]);

  if (headings.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">No headings yet.</p>
    );
  }

  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <nav className="flex flex-col gap-0.5 py-2 text-sm">
      {headings.map((h, i) => (
        <button
          key={`${h.id}-${i}`}
          type="button"
          onClick={() => {
            const el = scrollContainer?.querySelector<HTMLElement>(`#${CSS.escape(h.id)}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className={cn(
            "truncate rounded px-2 py-1 text-left text-xs transition-colors hover:bg-accent",
            activeId === h.id
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground"
          )}
          style={{ paddingLeft: `${(h.level - minLevel) * 12 + 8}px` }}
          title={h.text}
        >
          {h.text}
        </button>
      ))}
    </nav>
  );
}
