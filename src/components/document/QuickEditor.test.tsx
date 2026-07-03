import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";
import { QuickEditor } from "./QuickEditor";

function setup(overrides: Partial<Parameters<typeof QuickEditor>[0]> = {}) {
  const props = {
    value: "# hello",
    error: undefined,
    onChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<QuickEditor {...props} />);
  return props;
}

describe("QuickEditor", () => {
  it("shows the raw source and reports edits", async () => {
    const props = setup();
    const textarea = screen.getByRole("textbox", { name: "Edit markdown source" });
    expect(textarea).toHaveValue("# hello");
    await userEvent.type(textarea, "!");
    expect(props.onChange).toHaveBeenCalledWith("# hello!");
  });

  it("saves via button and via ctrl/cmd+s", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "s", metaKey: true });
    expect(props.onSave).toHaveBeenCalledTimes(2);
  });

  it("cancels via button and via escape", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(props.onCancel).toHaveBeenCalledTimes(2);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("renders a save error inline", () => {
    setup({ error: "permission denied" });
    expect(screen.getByText("permission denied")).toBeInTheDocument();
  });
});
