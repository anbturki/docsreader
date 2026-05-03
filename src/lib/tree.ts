import type { MarkdownFile } from "./scan";

export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: MarkdownFile;
  segments?: string[];
}

export function buildTree(
  root: string,
  files: MarkdownFile[],
  options: { compact?: boolean } = {}
): TreeNode {
  const rootNode: TreeNode = {
    name: rootName(root),
    path: root,
    isDir: true,
    children: [],
  };

  for (const file of files) {
    const parts = file.relPath.split(/[\\/]/).filter(Boolean);
    let current = rootNode;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      if (isLeaf) {
        current.children.push({
          name: stripMdExtension(part),
          path: file.path,
          isDir: false,
          children: [],
          file,
        });
      } else {
        let next = current.children.find((c) => c.isDir && c.name === part);
        if (!next) {
          next = {
            name: part,
            path: parts.slice(0, i + 1).join("/"),
            isDir: true,
            children: [],
          };
          current.children.push(next);
        }
        current = next;
      }
    }
  }

  sortNode(rootNode);

  if (options.compact !== false) {
    rootNode.children = rootNode.children.map(compactNode);
  }

  return rootNode;
}

function compactNode(node: TreeNode): TreeNode {
  const compactedChildren = node.children.map(compactNode);
  let merged: TreeNode = { ...node, children: compactedChildren };
  let segments: string[] = merged.segments ?? [merged.name];

  while (
    merged.isDir &&
    merged.children.length === 1 &&
    merged.children[0].isDir
  ) {
    const child = merged.children[0];
    segments = [...segments, ...(child.segments ?? [child.name])];
    merged = {
      ...child,
      segments,
      name: segments.join(" / "),
    };
  }

  if (segments.length > 1) {
    merged.segments = segments;
  }

  return merged;
}

function sortNode(node: TreeNode) {
  node.children.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
  for (const child of node.children) {
    if (child.isDir) sortNode(child);
  }
}

function rootName(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || p;
}

function stripMdExtension(name: string): string {
  return name.replace(/\.mdx?$/i, "");
}
