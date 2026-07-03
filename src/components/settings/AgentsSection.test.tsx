import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { AgentClient } from "@/lib/agents";
import { AgentsSection } from "./AgentsSection";

vi.mock("@/lib/agents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agents")>()),
  detectAgentClients: vi.fn(),
  connectAgentClient: vi.fn(),
}));

import { connectAgentClient, detectAgentClients } from "@/lib/agents";

const CLIENTS: AgentClient[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    detected: true,
    status: "disconnected",
    configPath: "/home/u/.claude.json",
  },
  {
    id: "cursor",
    name: "Cursor",
    detected: true,
    status: "connected",
    configPath: "/home/u/.cursor/mcp.json",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    detected: false,
    status: "disconnected",
    configPath: "/home/u/.codeium/windsurf/mcp_config.json",
  },
];

beforeEach(() => {
  vi.mocked(detectAgentClients).mockResolvedValue(CLIENTS);
  vi.mocked(connectAgentClient).mockReset();
});

describe("AgentsSection", () => {
  it("lists detected clients with status and marks undetected ones", async () => {
    render(<AgentsSection />);
    expect(await screen.findByText("Claude Code")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Not detected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    expect(screen.getByText("/home/u/.claude.json")).toHaveAttribute(
      "title",
      "/home/u/.claude.json"
    );
  });

  it("connects a client and flips its row to connected", async () => {
    vi.mocked(connectAgentClient).mockResolvedValue({
      ...CLIENTS[0],
      status: "connected",
    });
    render(<AgentsSection />);
    await userEvent.click(await screen.findByRole("button", { name: "Connect" }));
    expect(connectAgentClient).toHaveBeenCalledWith("claude-code");
    await waitFor(() =>
      expect(screen.getAllByText("Connected")).toHaveLength(2)
    );
  });

  it("shows the error on the row when connect fails", async () => {
    vi.mocked(connectAgentClient).mockRejectedValue(
      "config.json is not valid JSON"
    );
    render(<AgentsSection />);
    await userEvent.click(await screen.findByRole("button", { name: "Connect" }));
    expect(
      await screen.findByText("config.json is not valid JSON")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeEnabled();
  });
});
