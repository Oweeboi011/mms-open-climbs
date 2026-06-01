/**
 * Tests for the Admin Manage Payments page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import {
  renderWithProviders,
  makeAdminAuth,
  registrationFixture,
} from "@/test/helpers";
import ManagePayments from "@/pages/admin/ManagePayments";
import { onSnapshot, getDocs } from "firebase/firestore";
import { makeQuerySnapshot } from "@/test/setup";

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
});
