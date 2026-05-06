export interface DocsYamlProject {
  slug?: string;
  name?: string;
  tagline?: string;
  scope?: string;
  icon?: string;
  color?: string;
  homepage?: string;
}

export interface DocsYamlNavItemMarkdown {
  title: string;
  path: string;
  slug?: string;
  badge?: string;
}

export interface DocsYamlNavItemOpenApi {
  title: string;
  openapi: string;
  slug?: string;
  badge?: string;
}

export type DocsYamlNavItem = DocsYamlNavItemMarkdown | DocsYamlNavItemOpenApi;

export interface DocsYamlNavSectionItems {
  title: string;
  collapsed?: boolean;
  items: DocsYamlNavItem[];
}

export interface DocsYamlNavSectionFolder {
  title: string;
  collapsed?: boolean;
  folder: string;
  sort?: string;
  direction?: string;
  title_from?: string;
  pattern?: string;
  nested?: boolean;
}

export type DocsYamlNavSection = DocsYamlNavSectionItems | DocsYamlNavSectionFolder;

export interface DocsYaml {
  spec_version?: string;
  project?: DocsYamlProject;
  navigation?: DocsYamlNavSection[];
  ignore?: string[];
  visibility?: string;
}

export function isItemsSection(s: DocsYamlNavSection): s is DocsYamlNavSectionItems {
  return Array.isArray((s as DocsYamlNavSectionItems).items);
}

export function isFolderSection(s: DocsYamlNavSection): s is DocsYamlNavSectionFolder {
  return typeof (s as DocsYamlNavSectionFolder).folder === "string";
}

export function isMarkdownItem(i: DocsYamlNavItem): i is DocsYamlNavItemMarkdown {
  return typeof (i as DocsYamlNavItemMarkdown).path === "string";
}

export function hasNavigation(d: DocsYaml | undefined): d is DocsYaml & {
  navigation: DocsYamlNavSection[];
} {
  return !!d && Array.isArray(d.navigation) && d.navigation.length > 0;
}

export interface ProjectMeta {
  name: string;
  tagline?: string;
  scope?: string;
}

export function getProjectMeta(d: DocsYaml | undefined): ProjectMeta | undefined {
  const name = d?.project?.name?.trim();
  if (!name) return undefined;
  return {
    name,
    tagline: d?.project?.tagline?.trim() || undefined,
    scope: d?.project?.scope?.trim() || undefined,
  };
}

export function getIgnorePatterns(d: DocsYaml | undefined): string[] {
  const list = d?.ignore;
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const v of list) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (trimmed) out.push(trimmed);
  }
  return out;
}
