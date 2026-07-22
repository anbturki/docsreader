import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const handlers = {
  onSelect: vi.fn(),
  onRemove: vi.fn(),
  onAdd: vi.fn(),
};

const ROOTS = ["/ws/voice", "/ws/plain-folder"];
const NAMES = { "/ws/voice": "Vinfra Voice" };

function renderSwitcher(
  roots = ROOTS,
  activeRoot: string | undefined = "/ws/voice",
  workspaceNamesByRoot: Record<string, string> = NAMES
) {
  return render(
    <SidebarProvider>
      <WorkspaceSwitcher
        roots={roots}
        activeRoot={activeRoot}
        workspaceNamesByRoot={workspaceNamesByRoot}
        onSelect={handlers.onSelect}
        onRemove={handlers.onRemove}
        onAdd={handlers.onAdd}
      />
    </SidebarProvider>
  );
}

function trigger() {
  return screen.getByRole("button", { name: /switch workspace/i });
}

// SidebarProvider reads matchMedia, which jsdom does not implement.
beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  Object.values(handlers).forEach((h) => h.mockReset());
});

describe("WorkspaceSwitcher", () => {
  it("shows the active workspace on the trigger with its full path", () => {
    renderSwitcher();

    expect(trigger()).toHaveTextContent("Vinfra Voice");
    expect(trigger()).toHaveAttribute("title", "Vinfra Voice\n/ws/voice");
  });

  it("falls back to the folder name when a workspace has no marker name", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(trigger());

    const items = await screen.findAllByRole("menuitem");
    const labels = items.map((item) => item.textContent);
    expect(labels.some((label) => label?.includes("Vinfra Voice"))).toBe(true);
    expect(labels.some((label) => label?.includes("plain-folder"))).toBe(true);
  });

  it("selects a workspace from the menu", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(trigger());

    await user.click(await screen.findByRole("menuitem", { name: /plain-folder/ }));

    expect(handlers.onSelect).toHaveBeenCalledWith("/ws/plain-folder");
  });

  it("adds a workspace", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(trigger());

    await user.click(await screen.findByRole("menuitem", { name: "Add workspace" }));

    expect(handlers.onAdd).toHaveBeenCalledTimes(1);
  });

  // Driven by keyboard: Radix decides whether a submenu stays open from pointer
  // geometry, and every rect is 0x0 under jsdom, so a hovered submenu closes.
  it("removes a workspace from the remove submenu", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(trigger());

    const removeTrigger = await screen.findByRole("menuitem", {
      name: "Remove workspace",
    });
    removeTrigger.focus();
    await user.keyboard("{ArrowRight}");

    const removeMenu = await screen.findByRole("menu", {
      name: "Remove workspace",
    });
    within(removeMenu).getByRole("menuitem", { name: /Vinfra Voice/ }).focus();
    await user.keyboard("{Enter}");

    expect(handlers.onRemove).toHaveBeenCalledWith("/ws/voice");
    expect(handlers.onSelect).not.toHaveBeenCalled();
  });

  it("distinguishes workspaces whose folders share a basename", async () => {
    const user = userEvent.setup();
    renderSwitcher(["/alpha/docs", "/beta/docs"], "/alpha/docs", {});
    await user.click(trigger());

    const items = await screen.findAllByRole("menuitem");
    const labels = items.map((item) => item.textContent);
    expect(labels.some((label) => label?.includes("alpha/docs"))).toBe(true);
    expect(labels.some((label) => label?.includes("beta/docs"))).toBe(true);
    expect(
      screen.getByRole("menuitem", { name: /alpha\/docs/ })
    ).toHaveAttribute("title", "/alpha/docs");
  });

  it("marks no workspace as current before one is active", async () => {
    const user = userEvent.setup();
    render(
      <SidebarProvider>
        <WorkspaceSwitcher
          roots={ROOTS}
          activeRoot={undefined}
          workspaceNamesByRoot={NAMES}
          onSelect={handlers.onSelect}
          onRemove={handlers.onRemove}
          onAdd={handlers.onAdd}
        />
      </SidebarProvider>
    );
    await user.click(trigger());

    const items = await screen.findAllByRole("menuitem");
    const checked = items.filter((item) => item.querySelector("svg.lucide-check"));
    expect(checked).toHaveLength(0);
  });

  it("marks only the active workspace as current", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(trigger());

    const active = await screen.findByRole("menuitem", { name: /Vinfra Voice/ });
    const other = screen.getByRole("menuitem", { name: /plain-folder/ });
    expect(active.querySelector("svg.lucide-check")).not.toBeNull();
    expect(other.querySelector("svg.lucide-check")).toBeNull();
  });

  it("renders nothing without roots", () => {
    const { container } = render(
      <SidebarProvider>
        <WorkspaceSwitcher
          roots={[]}
          activeRoot={undefined}
          workspaceNamesByRoot={{}}
          onSelect={handlers.onSelect}
          onRemove={handlers.onRemove}
          onAdd={handlers.onAdd}
        />
      </SidebarProvider>
    );
    expect(container.querySelector("[data-slot='sidebar-menu']")).toBeNull();
  });
});
