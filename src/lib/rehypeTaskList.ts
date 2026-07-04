import type { Element, Root, RootContent } from "hast";

// Stamp each GFM task-list checkbox with its document-order index so the viewer
// can map a click back to the Nth checkbox in the source body. The index order
// matches how remark-gfm emits checkboxes, which is the same order
// toggleTaskCheckbox counts them.
export function rehypeTaskList() {
  return (tree: Root): void => {
    let index = 0;
    const walk = (children: RootContent[]): void => {
      for (const node of children) {
        if (node.type !== "element") continue;
        const el = node as Element;
        if (el.tagName === "input" && el.properties?.type === "checkbox") {
          el.properties.dataTaskIndex = index;
          index += 1;
        }
        walk(el.children);
      }
    };
    walk(tree.children);
  };
}
