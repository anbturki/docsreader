import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { TaskCard } from "./TaskCard";
import type { Task } from "@/lib/tasks";

const TASK: Task = {
  id: "task-14",
  title: "Header UI",
  status: "In Progress",
  assignee: ["claude-code"],
  labels: [],
  dependencies: [],
  priority: "high",
  createdDate: null,
  updatedDate: null,
  relPath: "tasks/task-14.md",
  path: "/ws/tasks/task-14.md",
};

function renderCard(over: Partial<Parameters<typeof TaskCard>[0]> = {}) {
  const onOpen = vi.fn();
  const onOpenInNewTab = vi.fn();
  const onOpenInOtherPane = vi.fn();
  render(
    <TaskCard
      task={TASK}
      progress={{ done: 2, total: 5 }}
      selected={false}
      onOpen={onOpen}
      onOpenInNewTab={onOpenInNewTab}
      onOpenInOtherPane={onOpenInOtherPane}
      {...over}
    />
  );
  const card = screen.getByText("Header UI").closest("button");
  if (!card) throw new Error("card button not found");
  return { onOpen, onOpenInNewTab, onOpenInOtherPane, card };
}

describe("Smoke C3: card opens correct doc", () => {
  it("opens the task in the active pane on plain click", () => {
    const { onOpen, onOpenInNewTab, card } = renderCard();
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledWith("/ws/tasks/task-14.md");
    expect(onOpenInNewTab).not.toHaveBeenCalled();
  });

  it("opens in a new tab on modifier-click", () => {
    const { onOpen, onOpenInNewTab, card } = renderCard();
    fireEvent.click(card, { metaKey: true });
    expect(onOpenInNewTab).toHaveBeenCalledWith("/ws/tasks/task-14.md");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("opens in a new tab on middle-click", () => {
    const { onOpenInNewTab, card } = renderCard();
    fireEvent(card, new MouseEvent("auxclick", { button: 1, bubbles: true }));
    expect(onOpenInNewTab).toHaveBeenCalledWith("/ws/tasks/task-14.md");
  });

  it("renders the card fields it will show in the pane header", () => {
    renderCard();
    expect(screen.getByText("high")).toBeTruthy();
    expect(screen.getByText("claude-code")).toBeTruthy();
    expect(screen.getByText("2/5")).toBeTruthy();
  });
});
