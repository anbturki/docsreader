import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { FindBar } from "./FindBar";
import type { FindInDocument } from "@/hooks/useFindInDocument";

const actions = {
  setQuery: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
};

function find(overrides: Partial<FindInDocument> = {}): FindInDocument {
  return {
    open: true,
    query: "needle",
    matchCount: 17,
    currentIndex: 2,
    ...actions,
    ...overrides,
  };
}

describe("FindBar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the position within the matches", () => {
    render(<FindBar find={find()} />);

    expect(screen.getByText("3 of 17")).toBeInTheDocument();
  });

  it("says when nothing matched", () => {
    render(<FindBar find={find({ matchCount: 0, currentIndex: -1 })} />);

    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("shows no count before anything is typed", () => {
    render(<FindBar find={find({ query: "", matchCount: 0, currentIndex: -1 })} />);

    expect(screen.queryByText("No results")).not.toBeInTheDocument();
  });

  it("moves to the next match", async () => {
    const user = userEvent.setup();
    render(<FindBar find={find()} />);

    await user.click(screen.getByLabelText("Next match"));

    expect(actions.next).toHaveBeenCalled();
  });

  it("moves to the previous match", async () => {
    const user = userEvent.setup();
    render(<FindBar find={find()} />);

    await user.click(screen.getByLabelText("Previous match"));

    expect(actions.previous).toHaveBeenCalled();
  });

  it("disables navigation when there is nothing to step through", () => {
    render(<FindBar find={find({ matchCount: 0, currentIndex: -1 })} />);

    expect(screen.getByLabelText("Next match")).toBeDisabled();
    expect(screen.getByLabelText("Previous match")).toBeDisabled();
  });

  it("advances on Enter and steps back on Shift+Enter", async () => {
    const user = userEvent.setup();
    render(<FindBar find={find()} />);
    const input = screen.getByLabelText("Find in document");

    await user.click(input);
    await user.keyboard("{Enter}");
    expect(actions.next).toHaveBeenCalledTimes(1);

    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(actions.previous).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<FindBar find={find()} />);

    await user.click(screen.getByLabelText("Find in document"));
    await user.keyboard("{Escape}");

    expect(actions.hide).toHaveBeenCalled();
  });

  it("closes from the close button", async () => {
    const user = userEvent.setup();
    render(<FindBar find={find()} />);

    await user.click(screen.getByLabelText("Close find"));

    expect(actions.hide).toHaveBeenCalled();
  });

  it("reports typing to the caller", async () => {
    const user = userEvent.setup();
    render(<FindBar find={find({ query: "" })} />);

    await user.type(screen.getByLabelText("Find in document"), "a");

    expect(actions.setQuery).toHaveBeenCalledWith("a");
  });
});
