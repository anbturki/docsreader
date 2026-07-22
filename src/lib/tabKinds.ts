import { basename } from "./path";

export const TAB_KINDS = ["file", "tasks"] as const;
export type TabKind = (typeof TAB_KINDS)[number];

// `ref` is read by the kind that owns it: a file tab's ref is its absolute
// path, and a kind that has only one instance leaves it empty.
export interface TabTarget {
  kind: TabKind;
  ref: string;
}

export interface TabKindSpec {
  title(ref: string): string;
  // Only a kind backed by a file on disk is loaded, watched, edited, and
  // scroll-restored; everything else in a tab is the kind's own business.
  readsFromDisk: boolean;
}

// What a tab of each kind is. What draws it lives beside the components, in
// TAB_KIND_VIEWS; both are keyed on TAB_KINDS, so a new kind cannot land in
// one without the other.
export const TAB_KIND_SPECS: Record<TabKind, TabKindSpec> = {
  file: { title: basename, readsFromDisk: true },
  tasks: { title: () => "Tasks", readsFromDisk: false },
};

export function fileTarget(path: string): TabTarget {
  return { kind: "file", ref: path };
}

export const TASKS_TARGET: TabTarget = { kind: "tasks", ref: "" };

export function targetKey(target: TabTarget): string {
  return `${target.kind}:${target.ref}`;
}

export function isTabKind(value: unknown): value is TabKind {
  return TAB_KINDS.some((kind) => kind === value);
}

export function toTabTarget(value: unknown): TabTarget | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { kind, ref } = value as { kind?: unknown; ref?: unknown };
  if (!isTabKind(kind) || typeof ref !== "string") return undefined;
  return { kind, ref };
}
