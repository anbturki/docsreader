import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvertWorkspacePrompt } from "./ConvertWorkspacePrompt";

describe("ConvertWorkspacePrompt", () => {
  it("names the folder and fires the matching callback per choice", async () => {
    const user = userEvent.setup();
    const onConvert = vi.fn();
    const onDecline = vi.fn();
    render(
      <ConvertWorkspacePrompt
        folderName="my-notes"
        onConvert={onConvert}
        onDecline={onDecline}
      />
    );

    expect(
      screen.getByRole("heading", { name: /my-notes/ })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Convert to workspace" }));
    expect(onConvert).toHaveBeenCalledTimes(1);
    expect(onDecline).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Keep read-only" }));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it("treats closing the dialog as declining", async () => {
    const user = userEvent.setup();
    const onDecline = vi.fn();
    render(
      <ConvertWorkspacePrompt
        folderName="my-notes"
        onConvert={vi.fn()}
        onDecline={onDecline}
      />
    );

    await user.keyboard("{Escape}");
    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});
