import { invoke } from "@tauri-apps/api/core";

export const WORKSPACE_SCOPES = ["user", "project"] as const;
export type WorkspaceScope = (typeof WORKSPACE_SCOPES)[number];

export interface RegistryWorkspace {
  slug: string;
  path: string;
  scope: WorkspaceScope;
}

export function listRegistryWorkspaces(): Promise<RegistryWorkspace[]> {
  return invoke<RegistryWorkspace[]>("list_registry_workspaces");
}

export function registryDir(): Promise<string> {
  return invoke<string>("registry_dir");
}
