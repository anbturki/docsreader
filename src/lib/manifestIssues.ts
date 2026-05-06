import {
  hasNavigation,
  isFolderSection,
  isItemsSection,
  isMarkdownItem,
  type DocsYaml,
} from "./docsYaml";
import type { MarkdownFile } from "./scan";

export type ManifestIssueKind =
  | "schema"
  | "missing-path"
  | "empty-folder"
  | "unknown-cross-link";

export interface ManifestIssue {
  kind: ManifestIssueKind;
  message: string;
}

export function computeManifestIssues(opts: {
  docsYaml: DocsYaml | undefined;
  docsYamlError: string | undefined;
  files: MarkdownFile[];
  knownSlugs: Set<string>;
  ownSlug: string | undefined;
}): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  if (opts.docsYamlError) {
    issues.push({ kind: "schema", message: opts.docsYamlError });
  }
  const docsYaml = opts.docsYaml;
  if (!docsYaml) return issues;

  if (hasNavigation(docsYaml)) {
    const fileSet = new Set(
      opts.files.map((f) => f.relPath.replace(/\\/g, "/"))
    );
    for (const section of docsYaml.navigation) {
      if (isItemsSection(section)) {
        for (const item of section.items) {
          if (!isMarkdownItem(item)) continue;
          const rel = item.path.replace(/\\/g, "/").replace(/^\.\//, "");
          if (!fileSet.has(rel)) {
            issues.push({
              kind: "missing-path",
              message: `${section.title}: ${rel} not found`,
            });
          }
        }
      } else if (isFolderSection(section)) {
        const folder = section.folder
          .replace(/\\/g, "/")
          .replace(/^\.\//, "")
          .replace(/\/+$/, "");
        const hasAny = opts.files.some((f) => {
          const rel = f.relPath.replace(/\\/g, "/");
          return folder === "" || rel === folder || rel.startsWith(folder + "/");
        });
        if (!hasAny) {
          issues.push({
            kind: "empty-folder",
            message: `${section.title}: ${section.folder} contains no matching files`,
          });
        }
      }
    }
  }

  if (Array.isArray(docsYaml.cross_links)) {
    for (const link of docsYaml.cross_links) {
      if (link.project === opts.ownSlug) continue;
      if (!opts.knownSlugs.has(link.project)) {
        issues.push({
          kind: "unknown-cross-link",
          message: `Cross-link target not open: ${link.project} (${link.label})`,
        });
      }
    }
  }

  return issues;
}
