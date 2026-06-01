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
import { screen, waitFor } from "@testing-library/react";
import { onSnapshot, getDocs } from "firebase/firestore";
import MyRegistrations from "@/pages/MyRegistrations";
import {
  renderWithProviders,
  makeMemberAuth,
  registrationFixture,
} from "@/test/helpers";
import { makeQuerySnapshot } from "@/test/setup";

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
