import katex from "katex";
import { findRanges, FIND_CHROME_ATTR, MAX_RANGES } from "./findMatches";

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

function texts(ranges: Range[]): string[] {
  return ranges.map((range) => range.toString());
}

describe("findRanges", () => {
  it("finds a single match inside one text node", () => {
    const root = mount("<p>the quick brown fox</p>");

    const ranges = findRanges(root, "quick");

    expect(texts(ranges)).toEqual(["quick"]);
    expect(ranges[0].startContainer).toBe(ranges[0].endContainer);
  });

  it("returns matches in document order", () => {
    const root = mount("<p>alpha</p><p>beta</p><p>alpha again</p>");

    const ranges = findRanges(root, "alpha");

    expect(texts(ranges)).toEqual(["alpha", "alpha"]);
    expect(ranges[0].startContainer.textContent).toBe("alpha");
    expect(ranges[1].startContainer.textContent).toBe("alpha again");
  });

  it("matches across two text nodes", () => {
    const root = mount("<p><span>con</span><span>cat</span></p>");

    const ranges = findRanges(root, "oncat");

    expect(texts(ranges)).toEqual(["oncat"]);
    expect(ranges[0].startContainer).not.toBe(ranges[0].endContainer);
  });

  it("matches across three or more text nodes, as Shiki token spans produce", () => {
    const root = mount(
      "<pre><code><span>const</span><span> </span><span>value</span><span> = 1</span></code></pre>",
    );

    const ranges = findRanges(root, "const value =");

    expect(texts(ranges)).toEqual(["const value ="]);
    expect(ranges[0].startContainer).not.toBe(ranges[0].endContainer);
    expect(ranges[0].startContainer.textContent).toBe("const");
    expect(ranges[0].endContainer.textContent).toBe(" = 1");
  });

  it("is case-insensitive by default", () => {
    const root = mount("<p>Fox fox FOX</p>");

    expect(texts(findRanges(root, "fox"))).toEqual(["Fox", "fox", "FOX"]);
  });

  it("respects caseSensitive", () => {
    const root = mount("<p>Fox fox FOX</p>");

    expect(texts(findRanges(root, "fox", { caseSensitive: true }))).toEqual(["fox"]);
  });

  it("matches whole words only when wholeWord is set", () => {
    const root = mount("<p>cat catalog concat cat.</p>");

    expect(texts(findRanges(root, "cat", { wholeWord: true }))).toEqual(["cat", "cat"]);
    expect(findRanges(root, "cat")).toHaveLength(4);
  });

  it("treats non-ASCII letters as word characters for wholeWord", () => {
    const root = mount("<p>café cafés</p>");

    expect(texts(findRanges(root, "café", { wholeWord: true }))).toEqual(["café"]);
  });

  it("returns nothing for empty or whitespace-only queries", () => {
    const root = mount("<p>anything at all</p>");

    expect(findRanges(root, "")).toEqual([]);
    expect(findRanges(root, "   \n\t ")).toEqual([]);
  });

  it("returns nothing when the query is absent", () => {
    const root = mount("<p>anything at all</p>");

    expect(findRanges(root, "zebra")).toEqual([]);
  });

  it("treats regex metacharacters literally", () => {
    const root = mount("<p>a.b axb c++ cxx (x) [y]</p>");

    expect(texts(findRanges(root, "a.b"))).toEqual(["a.b"]);
    expect(texts(findRanges(root, "c++"))).toEqual(["c++"]);
    expect(texts(findRanges(root, "(x)"))).toEqual(["(x)"]);
    expect(texts(findRanges(root, "[y]"))).toEqual(["[y]"]);
  });

  it("skips script and style subtrees", () => {
    const root = mount(
      "<script>const target = 1;</script><style>.target { color: red }</style><p>target</p>",
    );

    const ranges = findRanges(root, "target");

    expect(ranges).toHaveLength(1);
    expect(ranges[0].startContainer.parentElement?.tagName).toBe("P");
  });

  it("skips aria-hidden subtrees", () => {
    const root = mount('<div aria-hidden="true"><p>ghost</p></div><p>ghost</p>');

    expect(findRanges(root, "ghost")).toHaveLength(1);
  });

  it("skips the katex-mathml mirror so the raw TeX annotation is not matched", () => {
    const root = mount(
      '<span class="katex"><span class="katex-mathml">' +
        '<annotation encoding="application/x-tex">E = mc^2</annotation>' +
        "</span></span><p>mc^2 in prose</p>",
    );

    const ranges = findRanges(root, "mc^2");

    expect(ranges).toHaveLength(1);
    expect(ranges[0].startContainer.parentElement?.tagName).toBe("P");
  });

  it("skips both halves of a real KaTeX formula, mirror and visible layer alike", () => {
    const root = mount(
      katex.renderToString("\\frac{\\alpha}{2}", { throwOnError: false }) +
        "<p>alpha in prose</p>",
    );

    // KaTeX sets aria-hidden on .katex-html itself (katex 0.16.45,
    // dist/katex.mjs:5645-5646), so the visible layer is excluded too.
    expect(root.querySelector(".katex-html")?.getAttribute("aria-hidden")).toBe("true");
    // CSS positions the numerator above the denominator, so document order
    // reverses what is read, and a strut contributes a zero-width space:
    // matching this text would highlight nonsense.
    expect(root.querySelector(".katex-html")?.textContent).toBe("2α​");

    const ranges = findRanges(root, "alpha");

    expect(ranges).toHaveLength(1);
    expect(ranges[0].startContainer.parentElement?.tagName).toBe("P");
    expect(findRanges(root, "α")).toEqual([]);
  });

  it("returns nothing when the root itself is excluded", () => {
    const root = mount("<p>visible</p>");
    root.setAttribute("aria-hidden", "true");

    expect(findRanges(root, "visible")).toEqual([]);
  });

  it("handles astral-plane characters without splitting surrogate pairs", () => {
    const root = mount("<p>hello 😀 world 😀</p>");

    const ranges = findRanges(root, "😀");

    expect(texts(ranges)).toEqual(["😀", "😀"]);
    expect(ranges[0].startOffset).toBe(6);
    expect(ranges[0].endOffset).toBe(8);
  });

  it("finds astral content spanning text nodes", () => {
    const root = mount("<p><span>a😀</span><span>b</span></p>");

    const ranges = findRanges(root, "😀b");

    expect(texts(ranges)).toEqual(["😀b"]);
    expect(ranges[0].startContainer).not.toBe(ranges[0].endContainer);
  });

  it("stays correct where toLowerCase is not length-preserving", () => {
    expect("İ".toLowerCase()).toHaveLength(2);
    expect("İ").toHaveLength(1);

    const root = mount("<p>İstanbul</p>");
    const ranges = findRanges(root, "İstanbul");

    expect(texts(ranges)).toEqual(["İstanbul"]);
    expect(ranges[0].endOffset).toBe(8);
  });

  it("returns non-overlapping occurrences", () => {
    const root = mount("<p>aaaa</p>");

    const ranges = findRanges(root, "aa");

    expect(texts(ranges)).toEqual(["aa", "aa"]);
    expect(ranges[0].startOffset).toBe(0);
    expect(ranges[1].startOffset).toBe(2);
  });

  it("ignores empty text nodes when building offsets", () => {
    const root = document.createElement("div");
    root.appendChild(document.createTextNode(""));
    root.appendChild(document.createTextNode("needle"));

    const ranges = findRanges(root, "needle");

    expect(texts(ranges)).toEqual(["needle"]);
  });
});

describe("find chrome", () => {
  it("skips the find bar's own label, so its counter cannot count itself", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div ${FIND_CHROME_ATTR}><span>No results</span></div>
      <p>nothing here</p>`;
    document.body.appendChild(root);

    // "no" appears in the bar's "No results" and once in the prose.
    expect(findRanges(root, "no")).toHaveLength(1);
    root.remove();
  });

  it("caps the ranges it builds for a query that matches everywhere", () => {
    const root = document.createElement("div");
    root.textContent = "a".repeat(MAX_RANGES + 500);
    document.body.appendChild(root);

    expect(findRanges(root, "a")).toHaveLength(MAX_RANGES);
    root.remove();
  });
});
