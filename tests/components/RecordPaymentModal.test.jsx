/**
 * Tests for the admin "Record Payment" modal — logging money received
 * outside the app.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RecordPaymentModal from "@/components/admin/RecordPaymentModal";

const reg = {
  id: "reg-1",
  name: "Juan Cruz",
  amountPaid: 500,
  payments: [{ amount: 500, proofs: [], status: "verified" }],
};

function setup(overrides = {}) {
  const onSave = overrides.onSave || vi.fn().mockResolvedValue(undefined);
  const onClose = overrides.onClose || vi.fn();
  render(
    <RecordPaymentModal
      reg={overrides.reg || reg}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return { onSave, onClose };
}

const amountInput = () => document.querySelector('input[type="number"]');
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: /^Record Payment$/i }));

describe("RecordPaymentModal", () => {
  it("names the registrant and the position this payment will take", () => {
    setup();
    expect(screen.getByText("Juan Cruz")).toBeInTheDocument();
    expect(screen.getByText(/payment 2/i)).toBeInTheDocument();
  });

  it("previews the new total as the amount is typed", () => {
    setup();
    expect(screen.getByText(/Already recorded: ₱500/)).toBeInTheDocument();
    fireEvent.change(amountInput(), { target: { value: "300" } });
    expect(screen.getByText(/new total ₱800/)).toBeInTheDocument();
  });

  it("refuses to save without an amount", async () => {
    const { onSave } = setup();
    submit();
    await waitFor(() =>
      expect(screen.getByText("Enter the amount received.")).toBeInTheDocument(),
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("refuses a zero amount — the field's own min blocks the submit", () => {
    const { onSave } = setup();
    fireEvent.change(amountInput(), { target: { value: "0" } });
    submit();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves the amount, note and verified flag", async () => {
    const { onSave } = setup();
    fireEvent.change(amountInput(), { target: { value: "300" } });
    fireEvent.change(document.querySelector("textarea"), {
      target: { value: "cash at the jump-off" },
    });
    submit();

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(reg, {
      amount: 300,
      note: "cash at the jump-off",
      markVerified: true,
      files: [],
    });
  });

  it("lets the admin leave the payment awaiting review", async () => {
    const { onSave } = setup();
    fireEvent.change(amountInput(), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("checkbox"));
    submit();

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1].markVerified).toBe(false);
  });

  it("surfaces a failed save instead of closing silently", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("offline"));
    setup({ onSave });
    fireEvent.change(amountInput(), { target: { value: "300" } });
    submit();

    await waitFor(() =>
      expect(
        screen.getByText(/Failed to record the payment/i),
      ).toBeInTheDocument(),
    );
  });

  it("closes on Cancel without saving", () => {
    const { onSave, onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("starts from zero for a registrant who hasn't paid anything", () => {
    setup({ reg: { id: "reg-2", name: "Maria Santos" } });
    expect(screen.getByText(/Already recorded: ₱0/)).toBeInTheDocument();
    expect(screen.getByText(/payment 1/i)).toBeInTheDocument();
  });

  it("attaches selected proof files to the saved entry", async () => {
    const { onSave } = setup();
    fireEvent.change(amountInput(), { target: { value: "300" } });
    const file = new File(["x"], "receipt.jpg", { type: "image/jpeg" });
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText(/1 file selected/i)).toBeInTheDocument();
    submit();

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1].files).toEqual([file]);
  });
});
