import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// jsdom has no matchMedia, and "system" is the scheme that re-applies the theme
// from outside a React render.
class SchemeQuery extends EventTarget {
  matches = false;
}
const schemeQuery = new SchemeQuery();
vi.stubGlobal("matchMedia", () => schemeQuery);

// jsdom lays nothing out, so the pane would never look scrollable and the
// restore path would never run.
const DOCUMENT_HEIGHT = 5000;
const VIEWPORT = 800;
Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
  configurable: true,
  get: () => DOCUMENT_HEIGHT,
});
Object.defineProperty(HTMLElement.prototype, "clientHeight", {
  configurable: true,
  get: () => VIEWPORT,
});

import { defaultViewSettings, type ColorScheme } from "@/lib/storage";
import type { Tab } from "@/hooks/useTabs";
import { useTheme } from "@/hooks/useTheme";
import { TabScrollPane } from "./TabScrollPane";

const REF = "/w/notes/a.md";

const loadedTab: Tab = {
  id: "t1",
  kind: "file",
  ref: REF,
  title: "a.md",
  content: "# hello\n\nbody",
  meta: {},
  error: undefined,
  loading: false,
};
const loadingTab: Tab = { ...loadedTab, content: "", loading: true };

const memory = new Map<string, number>();

interface HarnessProps {
  colorScheme: ColorScheme;
  tab: Tab;
  active?: boolean;
}

function Harness({ colorScheme, tab, active = true }: HarnessProps) {
  useTheme(colorScheme, "violet");
  return (
    <TabScrollPane
      tab={tab}
      file={undefined}
      active={active}
      rootPath="/w"
      viewSettings={{ ...defaultViewSettings, colorScheme }}
      initialScrollTop={memory.get(tab.ref) ?? 0}
      onScrollChange={(ref, value) => memory.set(ref, value)}
      onNavigate={vi.fn()}
      paneFocused
      onAcceptPending={vi.fn()}
      onDismissPending={vi.fn()}
      onDiffViewModeChange={vi.fn()}
      onAlwaysAutoReload={vi.fn()}
      onBeginEdit={vi.fn()}
      onCancelEdit={vi.fn()}
      onSaveEdit={vi.fn()}
      onToggleTask={vi.fn()}
    />
  );
}

function paneOf(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

function scrollTo(el: HTMLElement, top: number): void {
  act(() => {
    el.scrollTop = top;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
}

describe("the reader's position in a document", () => {
  beforeEach(() => {
    memory.clear();
    schemeQuery.matches = false;
  });

  // A pane that mounts with its document already in hand is the split being
  // toggled: App swaps the single PaneView for the resizable group, so every
  // TabScrollPane under it is built afresh around content it already has.
  it("is remembered when the pane mounts with the document already loaded", () => {
    const { container } = render(
      <StrictMode>
        <Harness colorScheme="light" tab={loadedTab} />
      </StrictMode>
    );

    scrollTo(paneOf(container), 1200);

    expect(memory.get(REF)).toBe(1200);
  });

  it("is remembered when the pane mounts while the document is still loading", () => {
    const { container, rerender } = render(
      <StrictMode>
        <Harness colorScheme="light" tab={loadingTab} />
      </StrictMode>
    );
    rerender(
      <StrictMode>
        <Harness colorScheme="light" tab={loadedTab} />
      </StrictMode>
    );

    scrollTo(paneOf(container), 1200);

    expect(memory.get(REF)).toBe(1200);
  });

  it("survives a colour scheme change, in both directions and through system", () => {
    const { container, rerender } = render(
      <StrictMode>
        <Harness colorScheme="light" tab={loadingTab} />
      </StrictMode>
    );
    rerender(
      <StrictMode>
        <Harness colorScheme="light" tab={loadedTab} />
      </StrictMode>
    );
    const el = paneOf(container);
    scrollTo(el, 1200);

    const expectHeld = () => {
      expect(el.scrollTop).toBe(1200);
      expect(memory.get(REF)).toBe(1200);
    };

    rerender(
      <StrictMode>
        <Harness colorScheme="dark" tab={loadedTab} />
      </StrictMode>
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expectHeld();

    rerender(
      <StrictMode>
        <Harness colorScheme="light" tab={loadedTab} />
      </StrictMode>
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expectHeld();

    rerender(
      <StrictMode>
        <Harness colorScheme="system" tab={loadedTab} />
      </StrictMode>
    );
    act(() => {
      schemeQuery.matches = true;
      schemeQuery.dispatchEvent(new Event("change"));
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expectHeld();
  });

  it("is restored on mount and survives a tab switch", () => {
    memory.set(REF, 1200);
    const { container, rerender } = render(
      <StrictMode>
        <Harness colorScheme="light" tab={loadedTab} />
      </StrictMode>
    );
    const el = paneOf(container);
    expect(el.scrollTop).toBe(1200);

    scrollTo(el, 2400);

    rerender(
      <StrictMode>
        <Harness colorScheme="light" tab={loadedTab} active={false} />
      </StrictMode>
    );
    rerender(
      <StrictMode>
        <Harness colorScheme="light" tab={loadedTab} />
      </StrictMode>
    );

    expect(memory.get(REF)).toBe(2400);
    expect(el.scrollTop).toBe(2400);
  });
});
