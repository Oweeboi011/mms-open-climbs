/**
 * Tests for the MyRegistrations page.
 *
 * Scenarios:
 *  - Shows loading spinner initially
 *  - Renders registration cards when data is available
 *  - Shows empty state when no registrations exist
 *  - Shows correct status labels
 *  - Renders officer section when user is assigned as officer
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { onSnapshot, getDocs, getDoc } from "firebase/firestore";
import MyRegistrations from "@/pages/MyRegistrations";
import {
  renderWithProviders,
  makeMemberAuth,
  registrationFixture,
  climbFixture,
} from "@tests/helpers";
import { makeQuerySnapshot, makeSnapshot } from "@tests/setup";

describe("MyRegistrations page", () => {
  beforeEach(() => {
    // Officer climbs query
    getDocs.mockResolvedValue(makeQuerySnapshot([]));
    // Registrations listener — calls back immediately so loading resolves
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([]));
      return vi.fn();
    });
  });

  it("renders the page heading", async () => {
    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /My Climbs/i })).toBeInTheDocument(),
    );
  });

  it("shows user email in heading", async () => {
    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText("climber@example.com")).toBeInTheDocument(),
    );
  });

  it("renders a registration card when registrations exist", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          { id: registrationFixture.id, data: registrationFixture },
        ]),
      );
      return vi.fn();
    });
    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );
  });

  it("shows Pending status label for pending registrations", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          { id: registrationFixture.id, data: registrationFixture },
        ]),
      );
      return vi.fn();
    });
    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText(/Pending/i)).toBeInTheDocument(),
    );
  });

  it("shows Confirmed label for confirmed registrations", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          { id: "r2", data: { ...registrationFixture, status: "confirmed" } },
        ]),
      );
      return vi.fn();
    });
    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText(/Confirmed/i)).toBeInTheDocument(),
    );
  });

  it("updates the fee total when an optional fee is toggled in Submit Payment", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, {
        ...climbFixture,
        fees: [
          { label: "Registration Fee", amount: "500", optional: false },
          { label: "Transportation Fee", amount: "300", optional: true },
        ],
      }),
    );
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: registrationFixture.id,
            data: { ...registrationFixture, paymentStatus: "unpaid" },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Submit Payment/i }));
    await waitFor(() =>
      expect(screen.getByText("Fee Breakdown")).toBeInTheDocument(),
    );
    expect(screen.getByText("₱500")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(screen.getByText("₱800")).toBeInTheDocument());
  });

  it("lets a joiner add fees on an already-verified payment", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, {
        ...climbFixture,
        fees: [
          { label: "Registration Fee", amount: "500", optional: false },
          { label: "Transportation Fee", amount: "300", optional: true },
        ],
      }),
    );
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: registrationFixture.id,
            data: {
              ...registrationFixture,
              paymentStatus: "verified",
              amountPaid: 500,
              verifiedAt: { toDate: () => new Date("2026-07-10") },
              verifiedBy: { name: "Admin User" },
              feeBreakdown: [
                { label: "Registration Fee", amount: "500", optional: false, selected: true },
                { label: "Transportation Fee", amount: "300", optional: true, selected: false },
              ],
            },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Add Fees \/ Pay More/i }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Add Fees \/ Pay More/i }));

    await waitFor(() =>
      expect(screen.getByText("Fee Breakdown")).toBeInTheDocument(),
    );
    expect(screen.getByText("₱500")).toBeInTheDocument();

    expect(screen.getByText(/Already Paid: ₱500/i)).toBeInTheDocument();
    expect(screen.getByText(/Verified: /i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(screen.getByText("₱800")).toBeInTheDocument());
  });

  it("shows the Official Receipt with fee breakdown and verification details", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: registrationFixture.id,
            data: {
              ...registrationFixture,
              paymentStatus: "verified",
              amountPaid: 500,
              feeBreakdown: [
                { label: "Registration Fee", amount: "500", optional: false, selected: true },
              ],
              verifiedBy: { name: "Admin User" },
              verifiedAt: { toDate: () => new Date("2026-07-15") },
              paymentSubmittedAt: { toDate: () => new Date("2026-07-10") },
            },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /View OR/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /View OR/i }));

    await waitFor(() =>
      expect(screen.getByText("Official Receipt")).toBeInTheDocument(),
    );
    expect(screen.getByText("Admin User")).toBeInTheDocument();
  });

  it("shows a Submit Registration Form button with a download link when required and not yet uploaded", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, {
        ...climbFixture,
        requiresRegistrationForm: true,
        registrationFormUrl: "https://example.com/form.pdf",
      }),
    );
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: registrationFixture.id,
            data: { ...registrationFixture, paymentStatus: "verified" },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Submit Registration Form/i }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Submit Registration Form/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /Download Registration Form/i }),
      ).toBeInTheDocument(),
    );
  });

  it("shows officer section when user is an officer on a climb", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: "c1",
          data: {
            title: "Officer Climb",
            officers: [{ userId: "user-1", role: "Safety Officer" }],
            officerIds: ["user-1"],
            startDate: { toDate: () => new Date("2026-08-01") },
          },
        },
      ]),
    );
    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText(/Assigned as Officer/i)).toBeInTheDocument(),
    );
  });
});
