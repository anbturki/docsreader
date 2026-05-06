import { invoke } from "@tauri-apps/api/core";

export type GitFileStatusKind =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked"
  | "unmerged";

export interface GitFileStatus {
  path: string; // workspace-relative
  status: GitFileStatusKind;
  originalPath?: string;
}

export interface GitStatus {
  root: string; // git repo top-level
  files: GitFileStatus[];
}

export async function fetchGitStatus(workspace: string): Promise<GitStatus | undefined> {
  try {
    const result = await invoke<GitStatus | null>("git_status", { workspace });
    return result ?? undefined;
  } catch (err) {
    console.warn("git_status failed", err);
    return undefined;
  }
}

export async function fetchGitHead(
  workspace: string,
  path: string
): Promise<string | undefined> {
  try {
    const result = await invoke<string | null>("git_show_head", {
      workspace,
      path,
    });
    return result ?? undefined;
  } catch (err) {
    console.warn("git_show_head failed", err);
    return undefined;
  }
}
