export interface FindOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

interface TextChunk {
  node: Text;
  start: number;
  end: number;
}

interface FlatText {
  text: string;
  chunks: TextChunk[];
}

interface MatchSpan {
  start: number;
  end: number;
}

const EXCLUDED_TAGS = ["SCRIPT", "STYLE"] as const;

// KaTeX marks its own visible layer aria-hidden, so both halves of a formula
// are skipped and math is deliberately unfindable here: the visible text is
// ordered by CSS, not by document order, and \frac{\alpha}{2} flattens to
// "2α". Math is found by its LaTeX source in workspace search.
const MATHML_MIRROR_CLASS = "katex-mathml";

// The find bar renders inside the element it searches, so without this it
// matches its own "N of M" label: counts include the bar, and a query like
// "no" oscillates forever between "No results" and "1 of 1".
export const FIND_CHROME_ATTR = "data-find-chrome";

// A one-character query against a long document would otherwise build a Range
// per match. Painting already stops well before this, so the cap only bounds
// what a single keystroke can allocate.
export const MAX_RANGES = 2000;

function isExcludedElement(element: Element): boolean {
  if (EXCLUDED_TAGS.some((tag) => tag === element.tagName)) return true;
  if (element.getAttribute("aria-hidden") === "true") return true;
  if (element.hasAttribute(FIND_CHROME_ATTR)) return true;
  return element.classList.contains(MATHML_MIRROR_CLASS);
}

function filterNode(node: Node): number {
  if (!(node instanceof Element)) return NodeFilter.FILTER_ACCEPT;
  if (isExcludedElement(node)) return NodeFilter.FILTER_REJECT;
  return NodeFilter.FILTER_SKIP;
}

function documentOf(node: Node): Document | null {
  return node instanceof Document ? node : node.ownerDocument;
}

function flatten(root: Node): FlatText {
  const empty: FlatText = { text: "", chunks: [] };
  const doc = documentOf(root);
  if (!doc) return empty;
  if (root instanceof Element && isExcludedElement(root)) return empty;

  // SHOW_ELEMENT is required alongside SHOW_TEXT: the filter is only consulted
  // for nodes the whatToShow mask selects, so a text-only walker can never see
  // (and therefore never FILTER_REJECT) an excluded subtree's root.
  const walker = doc.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    filterNode,
  );

  const chunks: TextChunk[] = [];
  let text = "";

  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (!(node instanceof Text)) continue;
    if (node.data.length === 0) continue;
    chunks.push({ node, start: text.length, end: text.length + node.data.length });
    text += node.data;
  }

  return { text, chunks };
}

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveOptions(options: FindOptions): Required<FindOptions> {
  return {
    caseSensitive: options.caseSensitive ?? false,
    wholeWord: options.wholeWord ?? false,
  };
}

// \b is ASCII-only, so word edges are expressed as Unicode-aware lookarounds.
// Limitation: only letters, digits and _ count as word characters, so a query
// that itself starts or ends with punctuation can never satisfy the boundary.
function buildMatcher(query: string, options: Required<FindOptions>): RegExp {
  const escaped = escapeRegExp(query);
  const pattern = options.wholeWord
    ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`
    : escaped;
  const flags = options.caseSensitive ? "gu" : "giu";
  return new RegExp(pattern, flags);
}

function collectSpans(matcher: RegExp, text: string): MatchSpan[] {
  const spans: MatchSpan[] = [];

  for (let match = matcher.exec(text); match !== null; match = matcher.exec(text)) {
    if (match[0].length === 0) {
      // A zero-length match leaves lastIndex untouched and would spin forever.
      matcher.lastIndex += 1;
      continue;
    }
    spans.push({ start: match.index, end: match.index + match[0].length });
    if (spans.length === MAX_RANGES) break;
  }

  return spans;
}

function chunkIndexAt(chunks: TextChunk[], offset: number): number {
  let low = 0;
  let high = chunks.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (chunks[mid].end <= offset) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function createRange(doc: Document, chunks: TextChunk[], span: MatchSpan): Range {
  const startChunk = chunks[chunkIndexAt(chunks, span.start)];
  const endChunk = chunks[chunkIndexAt(chunks, span.end - 1)];
  const range = doc.createRange();
  range.setStart(startChunk.node, span.start - startChunk.start);
  range.setEnd(endChunk.node, span.end - endChunk.start);
  return range;
}

export function findRanges(root: Node, query: string, options: FindOptions = {}): Range[] {
  if (query.trim().length === 0) return [];

  const doc = documentOf(root);
  if (!doc) return [];

  const { text, chunks } = flatten(root);
  if (chunks.length === 0) return [];

  const matcher = buildMatcher(query, resolveOptions(options));
  return collectSpans(matcher, text).map((span) => createRange(doc, chunks, span));
}
