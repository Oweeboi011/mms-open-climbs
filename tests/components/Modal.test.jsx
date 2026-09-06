/**
 * Tests for the shared Modal shell — the accessibility behaviour every modal
 * in the app now inherits.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Modal from "@/components/Modal";

function open(props = {}) {
  const onClose = props.onClose || vi.fn();
  const utils = render(
    <Modal onClose={onClose} label="Test dialog" {...props}>
      <button>Inside</button>
    </Modal>,
  );
  return { onClose, ...utils };
}

describe("Modal", () => {
  it("is a labelled, modal dialog", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Test dialog");
  });

  it("closes on Escape", () => {
    const { onClose } = open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a backdrop click but not a click inside the card", () => {
    const { onClose } = open();
    fireEvent.click(screen.getByText("Inside"));
    expect(onClose).not.toHaveBeenCalled();
    // The backdrop is the dialog's parent.
    fireEvent.click(screen.getByRole("dialog").parentElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on a backdrop click when closeOnBackdrop is false", () => {
    const { onClose } = open({ closeOnBackdrop: false });
    fireEvent.click(screen.getByRole("dialog").parentElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("offers a close button unless suppressed", () => {
    const { onClose, rerender } = open();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <Modal onClose={onClose} label="Test dialog" showClose={false}>
        <button>Inside</button>
      </Modal>,
    );
    expect(
      screen.queryByRole("button", { name: /close/i }),
    ).not.toBeInTheDocument();
  });

  it("moves focus into the dialog and restores it on close", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Trigger";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = open();
    expect(screen.getByRole("dialog")).toHaveFocus();

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("locks body scroll while open and restores it, counting nested modals", () => {
    const first = render(
      <Modal onClose={vi.fn()} label="First">
        <span>one</span>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    const second = render(
      <Modal onClose={vi.fn()} label="Second">
        <span>two</span>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    second.unmount();
    expect(document.body.style.overflow).toBe("hidden");

    first.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps Tab from leaving the dialog", () => {
    open();
    const dialog = screen.getByRole("dialog");
    const inside = screen.getByText("Inside");
    inside.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    // Focus stays within the dialog subtree (jsdom has no layout, so the trap
    // falls back to focusing the dialog container itself).
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("Escape only closes the top-most modal", () => {
    const outerClose = vi.fn();
    const innerClose = vi.fn();
    render(
      <Modal onClose={outerClose} label="Outer">
        <span>outer</span>
      </Modal>,
    );
    render(
      <Modal onClose={innerClose} label="Inner">
        <span>inner</span>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(innerClose).toHaveBeenCalledTimes(1);
    expect(outerClose).not.toHaveBeenCalled();
  });
});
