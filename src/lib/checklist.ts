const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const FENCE = /^\s*(```|~~~)/;
const CHECKBOX_LINE = /^\s*[-*+]\s+\[([ xX])\]/;
const CHECKBOX_MARK = /\[[ xX]\]/;

// Flip the Nth (0-based) GFM task-list checkbox in the body of `raw`, counting
// in the same document order react-markdown renders. Frontmatter is preserved
// verbatim and excluded from the count; fenced code blocks are skipped so
// checkbox-looking lines inside code don't shift the index. Returns null when
// there is no Nth checkbox.
export function toggleTaskCheckbox(raw: string, index: number): string | null {
  const fm = FRONTMATTER.exec(raw);
  const head = fm && fm.index === 0 ? raw.slice(0, fm[0].length) : "";
  const lines = raw.slice(head.length).split("\n");

  let seen = 0;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    const match = inFence ? null : CHECKBOX_LINE.exec(lines[i]);
    if (!match) continue;
    if (seen === index) {
      const checked = match[1] !== " ";
      lines[i] = lines[i].replace(CHECKBOX_MARK, checked ? "[ ]" : "[x]");
      return head + lines.join("\n");
    }
    seen += 1;
  }
  return null;
}
