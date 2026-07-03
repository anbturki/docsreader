import { invoke } from "@tauri-apps/api/core";

export const AGENT_CLIENT_IDS = [
  "claude-code",
  "cursor",
  "windsurf",
  "vscode",
  "codex",
] as const;
export type AgentClientId = (typeof AGENT_CLIENT_IDS)[number];

export const CONNECTION_STATUSES = ["connected", "stale", "disconnected"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export interface AgentClient {
  id: AgentClientId;
  name: string;
  detected: boolean;
  status: ConnectionStatus;
  configPath: string;
}

export function detectAgentClients(): Promise<AgentClient[]> {
  return invoke<AgentClient[]>("detect_agent_clients");
}

export function connectAgentClient(id: AgentClientId): Promise<AgentClient> {
  return invoke<AgentClient>("connect_agent_client", { id });
}
