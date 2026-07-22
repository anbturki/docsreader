import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";

import { TaskFilterProvider, useTaskFilter } from "./TaskFilterContext";
import { TaskFilterPopover } from "./TaskFilterPopover";

// Stands in for the board, which owns the tasks and so publishes their labels
// and reads the filter back out.
function BoardStub({ labels }: { labels: string[] }) {
  const { filter, setFilter, setLabels } = useTaskFilter();
  return (
    <div>
      <button type="button" onClick={() => setLabels(labels)}>
        publish labels
      </button>
      <button type="button" onClick={() => setFilter({ ...filter, priority: "high" })}>
        set high
      </button>
      <output>{`${filter.priority ?? "any"} / ${filter.label ?? "any"}`}</output>
    </div>
  );
}

function renderPopover(labels: string[] = []) {
  return render(
    <TaskFilterProvider>
      <TaskFilterPopover />
      <BoardStub labels={labels} />
    </TaskFilterProvider>
  );
}

describe("TaskFilterPopover", () => {
  it("keeps the filters behind a trigger that announces its state", async () => {
    const user = userEvent.setup();
    renderPopover();

    const trigger = screen.getByRole("button", { name: "Filter tasks" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      within(screen.getByRole("dialog")).getByRole("combobox", { name: "Filter by priority" })
    ).toBeInTheDocument();
  });

  it("offers the label filter once the board publishes its labels", async () => {
    const user = userEvent.setup();
    renderPopover(["infra", "ui"]);

    await user.click(screen.getByRole("button", { name: "Filter tasks" }));
    expect(
      within(screen.getByRole("dialog")).queryByRole("combobox", { name: "Filter by label" })
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "publish labels" }));
    await user.click(screen.getByRole("button", { name: "Filter tasks" }));

    expect(
      within(screen.getByRole("dialog")).getByRole("combobox", { name: "Filter by label" })
    ).toBeInTheDocument();
  });

  it("shares one filter with the board and clears it", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole("button", { name: "set high" }));
    expect(screen.getByRole("status")).toHaveTextContent("high / any");

    await user.click(screen.getByRole("button", { name: "Filter tasks, filters active" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear filters" }));

    expect(screen.getByRole("status")).toHaveTextContent("any / any");
  });
});
