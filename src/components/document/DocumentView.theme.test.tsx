import { act, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { vi, describe, it, expect } from "vitest";

// jsdom has no matchMedia, and the "system" scheme is exactly the path that
// re-applies the theme from outside a React render.
class SchemeQuery extends EventTarget {
  matches = false;
}
const schemeQuery = new SchemeQuery();
vi.stubGlobal("matchMedia", () => schemeQuery);

const crepeInstances: MockCrepe[] = [];
let destroyCount = 0;

class MockCrepe {
  static Feature = { AI: "ai" };
  markdown: string;
  constructor({ defaultValue }: { defaultValue?: string }) {
    this.markdown = defaultValue ?? "";
    crepeInstances.push(this);
  }
  create() {
    return Promise.resolve();
  }
  destroy() {
    destroyCount += 1;
    return Promise.resolve();
  }
  getMarkdown() {
    return this.markdown;
  }
}

vi.mock("@milkdown/crepe", () => ({ Crepe: MockCrepe }));

import {
  defaultViewSettings,
  type AccentColor,
  type ColorScheme,
} from "@/lib/storage";
import type { Tab } from "@/hooks/useTabs";
import { useTheme } from "@/hooks/useTheme";
import { DocumentView } from "./DocumentView";

const DRAFT = "# hello";
const UNSAVED = "# hello, an unsaved edit";

const tab: Tab = {
  id: "t1",
  path: "/w/notes/a.md",
  title: "a.md",
  content: DRAFT,
  meta: {},
  error: undefined,
  loading: false,
  draft: DRAFT,
};

interface HarnessProps {
  colorScheme: ColorScheme;
  accentColor: AccentColor;
}

function Harness({ colorScheme, accentColor }: HarnessProps) {
  useTheme(colorScheme, accentColor);
  return (
    <DocumentView
      tab={tab}
      file={undefined}
      rootPath="/w"
      viewSettings={{ ...defaultViewSettings, colorScheme, accentColor }}
      onNavigate={vi.fn()}
      onBeginEdit={vi.fn()}
      onCancelEdit={vi.fn()}
      onSaveEdit={vi.fn()}
      onToggleTask={vi.fn()}
    />
  );
}

describe("the editor survives a theme change", () => {
  it("keeps its instance and unsaved draft across both directions, system, and accent", async () => {
    const { rerender } = render(
      <StrictMode>
        <Harness colorScheme="light" accentColor="violet" />
      </StrictMode>
    );

    await waitFor(() => expect(crepeInstances.length).toBeGreaterThan(0));
    const editor = crepeInstances[crepeInstances.length - 1];
    const host = screen.getByLabelText("Edit document");
    editor.markdown = UNSAVED;
    // StrictMode's throwaway first mount already destroyed one instance.
    const destroysAfterMount = destroyCount;

    const expectEditorIntact = () => {
      expect(screen.getByLabelText("Edit document")).toBe(host);
      expect(crepeInstances[crepeInstances.length - 1]).toBe(editor);
      expect(destroyCount).toBe(destroysAfterMount);
      expect(editor.getMarkdown()).toBe(UNSAVED);
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    };

    rerender(
      <StrictMode>
        <Harness colorScheme="dark" accentColor="violet" />
      </StrictMode>
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expectEditorIntact();

    rerender(
      <StrictMode>
        <Harness colorScheme="light" accentColor="violet" />
      </StrictMode>
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expectEditorIntact();

    rerender(
      <StrictMode>
        <Harness colorScheme="system" accentColor="violet" />
      </StrictMode>
    );
    act(() => {
      schemeQuery.matches = true;
      schemeQuery.dispatchEvent(new Event("change"));
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expectEditorIntact();

    rerender(
      <StrictMode>
        <Harness colorScheme="system" accentColor="green" />
      </StrictMode>
    );
    expectEditorIntact();
  });
});
