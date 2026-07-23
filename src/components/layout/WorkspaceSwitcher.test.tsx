/// <reference types="node" />
// Vitest stubs CSS module imports, so the theme tokens have to be read off disk.
import { readFileSync } from "node:fs";
import dropdownMenuSource from "@/components/ui/dropdown-menu.tsx?raw";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const THEME_SELECTOR: Record<Theme, string> = { light: ":root", dark: ".dark" };

const MIN_LIGHTNESS_DELTA = 0.4;

function themeTokens(theme: Theme): Record<string, number> {
  const block = readFileSync("src/index.css", "utf8").match(
    new RegExp(`\\${THEME_SELECTOR[theme]}\\s*\\{([^}]*)\\}`)
  );
  if (!block) throw new Error(`no ${THEME_SELECTOR[theme]} block in index.css`);

  const tokens: Record<string, number> = {};
  for (const [, name, lightness] of block[1].matchAll(
    /--([\w-]+):\s*oklch\(\s*([\d.]+)/g
  )) {
    tokens[name] = Number(lightness);
  }
  return tokens;
}

// The colour DropdownMenuItem forces onto every descendant while focused.
function forcedItemForeground(): string {
  const match = dropdownMenuSource.match(/focus:\*\*:text-([\w-]+)/);
  if (!match) throw new Error("dropdown-menu no longer forces a descendant colour");
  return match[1];
}

function tokenOf(
  element: Element,
  prefix: string,
  tokens: Record<string, number>
): string {
  const found = [...element.classList]
    .filter((name) => name.startsWith(prefix))
    .map((name) => name.slice(prefix.length))
    .find((token) => token in tokens);
  if (!found) throw new Error(`no ${prefix}<token> class on the badge`);
  return found;
}

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
  document.documentElement.classList.remove("dark");
  Object.values(handlers).forEach((h) => h.mockReset());
});

describe("WorkspaceSwitcher", () => {
  it("shows the active workspace on the trigger with its full path", () => {
    renderSwitcher();

    expect(trigger()).toHaveTextContent("Vinfra Voice");
    expect(trigger()).toHaveAttribute("title", "Vinfra Voice\n/ws/voice");
  });

  it("keeps the location off the trigger and on the menu rows", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    expect(trigger().textContent).not.toContain("ws/voice");

    await user.click(trigger());
    const row = await screen.findByRole("menuitem", { name: /Vinfra Voice/ });
    expect(row.textContent).toContain("Vinfra Voice");
    expect(row.textContent).toContain("ws/voice");
  });

  it("truncates a long workspace name instead of widening the trigger", () => {
    const root = "/ws/voice";
    renderSwitcher([root], root, {
      [root]: "A workspace name long enough to overrun any toolbar",
    });

    const label = [...trigger().querySelectorAll("span")].find((span) =>
      span.textContent?.startsWith("A workspace name")
    );
    expect(label?.className).toContain("truncate");
  });

  it.each(THEMES)(
    "keeps the badge legible on a focused row in the %s theme",
    async (theme) => {
      const user = userEvent.setup();
      document.documentElement.classList.toggle("dark", theme === "dark");
      renderSwitcher();
      await user.click(trigger());

      const row = await screen.findByRole("menuitem", { name: /Vinfra Voice/ });
      row.focus();
      const badge = row.querySelector("[data-slot='workspace-badge']");
      expect(badge).not.toBeNull();
      if (!badge) return;

      expect(badge.className).not.toContain("sidebar");

      const tokens = themeTokens(theme);
      const background = tokens[tokenOf(badge, "bg-", tokens)];
      const foregrounds = [tokenOf(badge, "text-", tokens), forcedItemForeground()];
      for (const foreground of foregrounds) {
        expect(Math.abs(tokens[foreground] - background)).toBeGreaterThanOrEqual(
          MIN_LIGHTNESS_DELTA
        );
      }
    }
  );

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

  it("labels a managed workspace by its project, not its notes folder", () => {
    renderSwitcher(["/code/acme-billing/notes"], "/code/acme-billing/notes", {});

    expect(trigger()).toHaveTextContent("acme-billing");
    expect(trigger().textContent).not.toContain("notes");
    expect(
      trigger().querySelector("[data-slot='workspace-badge']")?.textContent
    ).toBe("A");
  });

  it("labels an arbitrary folder by its own last segment", () => {
    renderSwitcher(["/code/scratchpad"], "/code/scratchpad", {});

    expect(trigger()).toHaveTextContent("scratchpad");
    expect(
      trigger().querySelector("[data-slot='workspace-badge']")?.textContent
    ).toBe("S");
  });

  it("prefers an explicit marker name over either fallback", () => {
    renderSwitcher(["/code/acme-billing/notes"], "/code/acme-billing/notes", {
      "/code/acme-billing/notes": "Billing",
    });

    expect(trigger()).toHaveTextContent("Billing");
    expect(
      trigger().querySelector("[data-slot='workspace-badge']")?.textContent
    ).toBe("B");
  });

  it("shows a pointer cursor on every clickable row", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(trigger());

    const rows = await screen.findAllByRole("menuitem");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.className).toContain("cursor-pointer");
      expect(row.className).not.toContain("cursor-default");
    }
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
