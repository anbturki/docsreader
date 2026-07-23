import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";

const { storeGet } = vi.hoisted(() => ({ storeGet: vi.fn() }));
vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    get = storeGet;
  },
}));

const { ShortcutsSection } = await import("./ShortcutsSection");
const { defaultViewSettings } = await import("@/lib/storage");

describe("ShortcutsSection", () => {
  it("offers a binding for each search surface", () => {
    render(<ShortcutsSection settings={defaultViewSettings} onChange={vi.fn()} />);

    for (const label of ["Quick open", "Find in document", "Search workspace"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("shows each binding using its platform symbols", () => {
    render(<ShortcutsSection settings={defaultViewSettings} onChange={vi.fn()} />);

    // The recorder renders the display form, never the stored "Mod+..." string.
    expect(screen.queryByText(/Mod\+/)).not.toBeInTheDocument();
  });
});
