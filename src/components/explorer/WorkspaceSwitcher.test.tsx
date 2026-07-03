import { render, screen } from "@testing-library/react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const noop = () => {};

describe("WorkspaceSwitcher", () => {
  it("labels workspaces by marker name, falling back to the folder name", () => {
    render(
      <WorkspaceSwitcher
        roots={["/ws/voice", "/ws/plain-folder"]}
        activeRoot="/ws/voice"
        workspaceNamesByRoot={{ "/ws/voice": "Vinfra Voice" }}
        onSelect={noop}
        onRemove={noop}
        onAdd={noop}
      />
    );

    const named = screen.getByRole("button", { name: "Vinfra Voice" });
    expect(named).toHaveAttribute("title", "Vinfra Voice\n/ws/voice");
    expect(screen.getByRole("button", { name: "plain-folder" })).toHaveAttribute(
      "title",
      "/ws/plain-folder"
    );
  });

  it("renders nothing without roots", () => {
    const { container } = render(
      <WorkspaceSwitcher
        roots={[]}
        activeRoot={undefined}
        workspaceNamesByRoot={{}}
        onSelect={noop}
        onRemove={noop}
        onAdd={noop}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
