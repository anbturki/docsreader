import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeAll } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

import { ExplorerSidebar } from "./ExplorerSidebar";

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    get = vi.fn();
    set = vi.fn();
    save = vi.fn();
  },
}));

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

function renderSidebar(roots: string[] = ["/ws/voice"]) {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <ExplorerSidebar
          roots={roots}
          activeRoot={roots[0]}
          activeScan={undefined}
          onPickDirectory={() => {}}
          onOpenWelcome={undefined}
          lens="tree"
          onLensChange={() => {}}
          search=""
          onSearchChange={() => {}}
          searchEntries={[]}
          searchScope="all"
          onSearchScopeChange={() => {}}
          searchingContents={false}
          searchError={undefined}
          searchTruncated={false}
          filteredFiles={[]}
          pinnedFiles={[]}
          tree={undefined}
          rootKey={roots[0] ?? ""}
          isExpanded={() => false}
          onToggleExpanded={() => {}}
          isPinned={() => false}
          onTogglePin={() => {}}
          onHide={() => {}}
          hiddenCount={0}
          onOpenSettings={() => {}}
          selectedPath={undefined}
          onSelectFile={() => {}}
          onOpenInNewTab={() => {}}
        />
      </SidebarProvider>
    </TooltipProvider>
  );
}

describe("ExplorerSidebar", () => {
  it("starts below the toolbar instead of at the top of the window", () => {
    const { container } = renderSidebar();
    const panel = container.querySelector('[data-slot="sidebar-container"]');
    expect(panel?.className).toContain("top-(--toolbar-height)");
    expect(panel?.className).not.toContain("h-svh");
  });

  it("leaves the workspace switcher to the toolbar", () => {
    renderSidebar();
    expect(screen.queryByRole("button", { name: /switch workspace/i })).toBeNull();
  });

  it("reserves no title-bar offset in its header", () => {
    const { container } = renderSidebar();
    for (const header of container.querySelectorAll('[data-slot="sidebar-header"]')) {
      expect(header.className).not.toContain("pt-9");
    }
  });
});
