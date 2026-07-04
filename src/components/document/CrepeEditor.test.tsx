import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

let lastCrepe: { markdown: string } | undefined;

vi.mock("@milkdown/crepe", () => {
  class Crepe {
    static Feature = { AI: "ai" };
    markdown: string;
    constructor({ defaultValue }: { defaultValue?: string }) {
      this.markdown = defaultValue ?? "";
      lastCrepe = this;
    }
    create() {
      return Promise.resolve();
    }
    destroy() {
      return Promise.resolve();
    }
    getMarkdown() {
      return this.markdown;
    }
  }
  return { Crepe };
});

import { CrepeEditor, type CrepeEditorHandle } from "./CrepeEditor";

function setup(overrides: Partial<Parameters<typeof CrepeEditor>[0]> = {}) {
  const ref = createRef<CrepeEditorHandle>();
  const props = {
    initialMarkdown: "# hello",
    fontSize: "md" as const,
    onRequestSave: vi.fn(),
    onCancel: vi.fn(),
    onReadyChange: vi.fn(),
    ...overrides,
  };
  render(<CrepeEditor ref={ref} {...props} />);
  return { ref, props };
}

beforeEach(() => {
  lastCrepe = undefined;
});

describe("CrepeEditor", () => {
  it("reports ready once the editor is created", async () => {
    const { props } = setup();
    await waitFor(() => expect(props.onReadyChange).toHaveBeenCalledWith(true));
  });

  it("getResult reports the markdown and dirty=true after an edit", async () => {
    const { ref, props } = setup();
    await waitFor(() => expect(props.onReadyChange).toHaveBeenCalledWith(true));
    lastCrepe!.markdown = "# hello edited";
    expect(ref.current?.getResult()).toEqual({
      markdown: "# hello edited",
      dirty: true,
    });
  });

  it("getResult reports dirty=false when nothing changed", async () => {
    const { ref, props } = setup();
    await waitFor(() => expect(props.onReadyChange).toHaveBeenCalledWith(true));
    expect(ref.current?.getResult()).toEqual({ markdown: "# hello", dirty: false });
  });

  it("requests save on cmd/ctrl+s and cancels on escape", async () => {
    const { props } = setup();
    await waitFor(() => expect(props.onReadyChange).toHaveBeenCalledWith(true));
    const host = screen.getByLabelText("Edit document");
    fireEvent.keyDown(host, { key: "s", metaKey: true });
    expect(props.onRequestSave).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(host, { key: "Escape" });
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });
});
