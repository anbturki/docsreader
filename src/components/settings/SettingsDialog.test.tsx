import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { defaultViewSettings } from "@/lib/storage";
import SettingsDialog from "./SettingsDialog";

vi.mock("@/lib/agents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agents")>()),
  detectAgentClients: vi.fn(),
  connectAgentClient: vi.fn(),
}));

import { detectAgentClients } from "@/lib/agents";

beforeEach(() => {
  vi.mocked(detectAgentClients).mockResolvedValue([]);
});

function renderDialog() {
  return render(
    <SettingsDialog
      open
      onOpenChange={vi.fn()}
      settings={defaultViewSettings}
      onChange={vi.fn()}
      onOpenWelcome={vi.fn()}
    />
  );
}

describe("SettingsDialog", () => {
  it("opens on the appearance section with all nav entries", () => {
    renderDialog();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    for (const label of ["Appearance", "Reading", "Explorer", "AI agents", "Shortcuts"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "Light" })).toBeInTheDocument();
  });

  it("switches to the AI agents section", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "AI agents" }));
    expect(await screen.findByText("Connect to AI agents")).toBeInTheDocument();
    expect(detectAgentClients).toHaveBeenCalled();
  });

  it("switches to the shortcuts section", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Shortcuts" }));
    expect(screen.getByText("Quick open")).toBeInTheDocument();
  });
});
