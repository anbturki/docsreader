import { useEffect, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  connectAgentClient,
  detectAgentClients,
  type AgentClient,
  type AgentClientId,
} from "@/lib/agents";
import { cn } from "@/lib/utils";

export function AgentsSection() {
  const [clients, setClients] = useState<AgentClient[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<AgentClientId | null>(null);
  const [rowErrors, setRowErrors] = useState<Partial<Record<AgentClientId, string>>>({});

  useEffect(() => {
    detectAgentClients()
      .then(setClients)
      .catch((e: unknown) => setLoadError(String(e)));
  }, []);

  const connect = async (id: AgentClientId) => {
    setBusyId(id);
    setRowErrors((prev) => ({ ...prev, [id]: undefined }));
    try {
      const updated = await connectAgentClient(id);
      setClients((prev) =>
        prev ? prev.map((c) => (c.id === id ? updated : c)) : prev
      );
    } catch (e: unknown) {
      setRowErrors((prev) => ({ ...prev, [id]: String(e) }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-sm font-medium">Connect to AI agents</div>
        <div className="text-xs text-muted-foreground">
          Register the DocsReader MCP server with agent tools installed on this
          machine, so they can read and write your docs, memory, and tasks.
        </div>
      </div>

      {loadError && <p className="text-xs text-destructive">{loadError}</p>}
      {!clients && !loadError && (
        <p className="text-xs text-muted-foreground">Detecting installed agents…</p>
      )}

      {clients && (
        <ul className="flex flex-col gap-2">
          {clients.map((client) => (
            <li
              key={client.id}
              className={cn(
                "flex flex-col gap-1 rounded-lg border bg-card px-3 py-2.5",
                !client.detected && "opacity-50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{client.name}</div>
                  <div
                    className="truncate font-mono text-[11px] text-muted-foreground"
                    title={client.configPath}
                  >
                    {client.configPath}
                  </div>
                </div>
                {client.detected ? (
                  <ClientAction
                    client={client}
                    busy={busyId === client.id}
                    onConnect={() => void connect(client.id)}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Not detected</span>
                )}
              </div>
              {rowErrors[client.id] && (
                <p className="text-xs text-destructive">{rowErrors[client.id]}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClientAction({
  client,
  busy,
  onConnect,
}: {
  client: AgentClient;
  busy: boolean;
  onConnect: () => void;
}) {
  if (client.status === "connected") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-primary">
        <Check className="size-3.5" />
        Connected
      </span>
    );
  }
  const stale = client.status === "stale";
  const connectLabel = busy ? "Connecting…" : stale ? "Update" : "Connect";
  return (
    <div className="flex items-center gap-2">
      {stale && (
        <span
          className="flex items-center gap-1 text-xs text-muted-foreground"
          title="Registered with an outdated server path"
        >
          <TriangleAlert className="size-3.5" />
          Outdated path
        </span>
      )}
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onConnect}>
        {connectLabel}
      </Button>
    </div>
  );
}
