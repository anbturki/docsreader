import picomatch from "picomatch";
import {
  hasNavigation,
  isFolderSection,
  isItemsSection,
  isMarkdownItem,
  type DocsYaml,
  type DocsYamlNavItemMarkdown,
  type DocsYamlNavSectionFolder,
} from "./docsYaml";
import type { MarkdownFile } from "./scan";
import type { TreeNode } from "./tree";

const DEFAULT_PATTERN = "*.md";

export function buildCuratedTree(
  root: string,
  files: MarkdownFile[],
  docsYaml: DocsYaml
): TreeNode {
  const rootNode: TreeNode = {
    name: rootName(root),
    path: root,
    isDir: true,
    children: [],
  };

  if (!hasNavigation(docsYaml)) return rootNode;

  const filesByRel = new Map<string, MarkdownFile>();
  for (const f of files) filesByRel.set(normalizeRel(f.relPath), f);

  for (const section of docsYaml.navigation) {
    const sectionNode: TreeNode = {
      name: section.title,
      path: `${root}::section::${section.title}`,
      isDir: true,
      children: [],
    };

    if (isItemsSection(section)) {
      for (const item of section.items) {
        if (!isMarkdownItem(item)) continue; // openapi items deferred
        sectionNode.children.push(buildItemNode(item, filesByRel));
      }
    } else if (isFolderSection(section)) {
      const folderChildren = buildFolderChildren(section, files);
      sectionNode.children.push(...folderChildren);
    }

    rootNode.children.push(sectionNode);
  }

  return rootNode;
}

function buildItemNode(
  item: DocsYamlNavItemMarkdown,
  filesByRel: Map<string, MarkdownFile>
): TreeNode {
  const rel = normalizeRel(item.path);
  const file = filesByRel.get(rel);
  if (!file) {
    return {
      name: item.title,
      path: `missing::${rel}`,
      isDir: false,
      children: [],
      badge: item.badge,
      missing: true,
    };
  }
  return {
    name: item.title,
    path: file.path,
    isDir: false,
    children: [],
    file,
    badge: item.badge,
  };
}

function buildFolderChildren(
  section: DocsYamlNavSectionFolder,
  files: MarkdownFile[]
): TreeNode[] {
  const folder = trimTrailingSlash(normalizeRel(section.folder));
  const pattern = section.pattern ?? DEFAULT_PATTERN;
  const nested = section.nested === true;
  const titleFrom = section.title_from ?? "heading";
  const sort = section.sort ?? "filename";
  const direction = section.direction ?? "asc";

  const fileMatcher = picomatch(nested ? `**/${pattern}` : pattern, { dot: true });

  type Entry = { node: TreeNode; relInFolder: string; sortKey: string };

  const collected: Entry[] = [];
  for (const f of files) {
    const rel = normalizeRel(f.relPath);
    if (!isUnderFolder(rel, folder)) continue;
    const relInFolder = rel.slice(folder.length === 0 ? 0 : folder.length + 1);
    if (!nested && relInFolder.includes("/")) continue;
    if (!fileMatcher(relInFolder)) continue;

    const title = deriveTitle(f, relInFolder, titleFrom);
    const sortKey = sort === "frontmatter:title" ? title.toLowerCase() : relInFolder.toLowerCase();

    collected.push({
      node: {
        name: title,
        path: f.path,
        isDir: false,
        children: [],
        file: f,
      },
      relInFolder,
      sortKey,
    });
  }

  collected.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  if (direction === "desc") collected.reverse();

  if (!nested) return collected.map((c) => c.node);

  const sectionRoot: TreeNode = {
    name: "",
    path: folder,
    isDir: true,
    children: [],
  };
  for (const { node, relInFolder } of collected) {
    insertNested(sectionRoot, relInFolder, node);
  }
  sortDirsRecursive(sectionRoot);
  return sectionRoot.children;
}

function insertNested(parent: TreeNode, relInFolder: string, leaf: TreeNode) {
  const parts = relInFolder.split("/").filter(Boolean);
  let current = parent;
  for (let i = 0; i < parts.length - 1; i++) {
    const segment = parts[i];
    let next = current.children.find((c) => c.isDir && c.name === segment);
    if (!next) {
      next = {
        name: segment,
        path: `${current.path}/${segment}`,
        isDir: true,
        children: [],
      };
      current.children.push(next);
    }
    current = next;
  }
  current.children.push(leaf);
}

function sortDirsRecursive(node: TreeNode) {
  node.children.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
  for (const c of node.children) if (c.isDir) sortDirsRecursive(c);
}

function deriveTitle(file: MarkdownFile, relInFolder: string, mode: string): string {
  if (mode === "filename") return prettifyFilename(relInFolder);
  if (mode === "heading" || mode === "frontmatter:title") {
    return file.title?.trim() || prettifyFilename(relInFolder);
  }
  if (mode.startsWith("frontmatter:")) {
    return file.title?.trim() || prettifyFilename(relInFolder);
  }
  return file.title?.trim() || prettifyFilename(relInFolder);
}

function prettifyFilename(relInFolder: string): string {
  const base = relInFolder.split("/").pop() ?? relInFolder;
  const noExt = base.replace(/\.(md|markdown|mdx)$/i, "");
  const noLeadingNum = noExt.replace(/^\d+[-_]?/, "");
  if (!noLeadingNum) return noExt;
  return noLeadingNum
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizeRel(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function trimTrailingSlash(p: string): string {
  return p.replace(/\/+$/, "");
}

function isUnderFolder(rel: string, folder: string): boolean {
  if (folder === "" || folder === ".") return true;
  return rel === folder || rel.startsWith(folder + "/");
}

function rootName(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || p;
}
