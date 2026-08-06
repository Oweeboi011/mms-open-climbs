/**
 * Tests for the Admin Manage Payments page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import {
  renderWithProviders,
  makeAdminAuth,
  registrationFixture,
  climbFixture,
} from "@tests/helpers";
import ManagePayments from "@/pages/admin/ManagePayments";
import { onSnapshot, getDocs, updateDoc } from "firebase/firestore";
import { makeQuerySnapshot } from "@tests/setup";

const paymentReg = {
  id: "pay-1",
  data: {
    ...registrationFixture,
    id: "pay-1",
    paymentStatus: "submitted",
    paymentFiles: ["https://example.com/receipt.jpg"],
    amountPaid: "500",
  },
};

describe("Admin ManagePayments", () => {
  beforeEach(() => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([paymentReg]));
      return vi.fn();
    });
    getDocs.mockResolvedValue(makeQuerySnapshot([]));
  });

  it("renders the Manage Payments heading", async () => {
    renderWithProviders(<ManagePayments />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Manage Payments", { selector: ".admin-page-title" })).toBeInTheDocument(),
    );
  });

  it("shows the awaiting review count after data loads", async () => {
    renderWithProviders(<ManagePayments />, makeAdminAuth());
    // Global stats render even when no climb cards are expanded
    await waitFor(() =>
      expect(screen.getByText(/Awaiting Review/i)).toBeInTheDocument(),
    );
  });

  it("shows the payment status badge for submitted payments", async () => {
    renderWithProviders(<ManagePayments />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText(/Submitted/i)).toBeInTheDocument(),
    );
  });

  it("shows the amount paid", async () => {
    renderWithProviders(<ManagePayments />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText(/500/)).toBeInTheDocument());
  });

  it("shows total outstanding based on unverified registrants' expected fees", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: climbFixture.id,
          data: { ...climbFixture, fees: [{ label: "Registration Fee", amount: "500", optional: false }] },
        },
      ]),
    );
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: "pay-1",
            data: {
              ...registrationFixture,
              id: "pay-1",
              paymentStatus: "unpaid",
              amountPaid: null,
            },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<ManagePayments />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Total Outstanding")).toBeInTheDocument(),
    );
    expect(screen.getByText("₱500")).toBeInTheDocument();
  });

  it("shows a transportation toggle even when the registrant's own fee snapshot lacks it, as long as the climb offers it", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: climbFixture.id,
          data: {
            ...climbFixture,
            fees: [{ label: "Transportation Fee", amount: "300", optional: true }],
          },
        },
      ]),
    );
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: "pay-1",
            data: {
              ...registrationFixture,
              id: "pay-1",
              paymentStatus: "submitted",
              amountPaid: "500",
              feeBreakdown: [], // no transport entry recorded yet
            },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<ManagePayments />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Mt. Pulag")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Mt. Pulag"));

    await waitFor(() => expect(screen.getByText("Own")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.find((c) => c[1]?.feeBreakdown)?.[1];
    expect(patch.feeBreakdown).toEqual([
      { label: "Transportation Fee", amount: "300", optional: true, selected: true },
    ]);
  });

  it("shows a fee breakdown when a registrant row is expanded", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([{ id: climbFixture.id, data: climbFixture }]),
    );
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: "pay-1",
            data: {
              ...registrationFixture,
              id: "pay-1",
              paymentStatus: "submitted",
              amountPaid: "500",
              feeBreakdown: [
                { label: "Registration Fee", amount: "500", optional: false, selected: true },
              ],
            },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<ManagePayments />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Mt. Pulag")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Mt. Pulag"));

    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() => expect(screen.getByText("Registration Fee")).toBeInTheDocument());
    expect(screen.getByText("Fee Breakdown (current fees)")).toBeInTheDocument();
  });

  it("shows each registrant's expected total at the climb's current fee amounts", async () => {
    // Registered when the fee was ₱500; the climb's schedule has since been
    // corrected to ₱750 — the Expected column must show the current amount.
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: climbFixture.id,
          data: {
            ...climbFixture,
            fees: [{ label: "Registration Fee", amount: "750", optional: false }],
          },
        },
      ]),
    );
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: "pay-1",
            data: {
              ...registrationFixture,
              id: "pay-1",
              paymentStatus: "submitted",
              amountPaid: "500",
              feeBreakdown: [
                { label: "Registration Fee", amount: "500", optional: false, selected: true },
              ],
            },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<ManagePayments />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Mt. Pulag")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Mt. Pulag"));

    await waitFor(() => expect(screen.getByText("Expected")).toBeInTheDocument());
    expect(screen.getAllByText("₱750").length).toBeGreaterThanOrEqual(1);
  });

  it("breaks out a registrant's instalments in the expanded row", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([{ id: climbFixture.id, data: climbFixture }]),
    );
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: "pay-1",
            data: {
              ...registrationFixture,
              id: "pay-1",
              paymentStatus: "submitted",
              amountPaid: 800,
              payments: [
                { amount: 500, proofs: [], submittedAt: null },
                { amount: 300, proofs: [], submittedAt: null, note: "balance" },
              ],
            },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<ManagePayments />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Mt. Pulag")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Mt. Pulag"));

    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    expect(screen.getByText("2 payments")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Juan Cruz"));
    await waitFor(() =>
      expect(screen.getByText(/Payment 1 of 2/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/balance/)).toBeInTheDocument();
    expect(screen.getByText(/Total across 2 payments/)).toBeInTheDocument();
  });

  it("lets an admin toggle a registrant's transportation selection", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([{ id: climbFixture.id, data: climbFixture }]),
    );
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: "pay-1",
            data: {
              ...registrationFixture,
              id: "pay-1",
              paymentStatus: "submitted",
              amountPaid: "500",
              feeBreakdown: [
                { label: "Transportation Fee", amount: "300", optional: true, selected: false },
              ],
            },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<ManagePayments />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Mt. Pulag")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Mt. Pulag"));

    await waitFor(() => expect(screen.getByText("Own")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.find((c) => c[1]?.feeBreakdown)?.[1];
    expect(patch.feeBreakdown[0].selected).toBe(true);
  });
});
