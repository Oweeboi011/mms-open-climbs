import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmDialog from "@/components/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("cancels on Escape while idle", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Delete?" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape while its action is running", () => {
    const onCancel = vi.fn();
    const { rerender } = render(<ConfirmDialog title="Delete?" onConfirm={vi.fn()} onCancel={onCancel} />);
    rerender(<ConfirmDialog title="Delete?" busy onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
