/**
 * Tests for the Admin Dashboard page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import {
  renderWithProviders,
  makeAdminAuth,
  climbFixture,
} from "@/test/helpers";
import Dashboard from "@/pages/admin/Dashboard";
import { onSnapshot, getDocs, getCountFromServer } from "firebase/firestore";
import { makeQuerySnapshot } from "@/test/setup";

const climbDoc = { id: climbFixture.id, data: { ...climbFixture } };
const regDoc = {
  id: "reg-1",
  data: {
    name: "Juan Cruz",
    climbId: "climb-1",
    status: "pending",
    createdAt: { toDate: () => new Date() },
  },
};

describe("Admin Dashboard", () => {
  beforeEach(() => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([regDoc]));
      return vi.fn();
    });
    getDocs.mockResolvedValue(makeQuerySnapshot([climbDoc]));
    getCountFromServer.mockResolvedValue({ data: () => ({ count: 5 }) });
  });

  it("renders the Dashboard heading", async () => {
    renderWithProviders(<Dashboard />, makeAdminAuth());
    await waitFor(() =>
      expect(
        screen.getByText("Dashboard", { selector: ".admin-page-title" }),
      ).toBeInTheDocument(),
    );
  });

  it("renders stat boxes after data loads", async () => {
    renderWithProviders(<Dashboard />, makeAdminAuth());
    await waitFor(() =>
      expect(
        screen.getAllByText(/Climbs|Registrations|Users|Pending/i).length,
      ).toBeGreaterThan(0),
    );
  });

  it("renders a recent registrations section", async () => {
    renderWithProviders(<Dashboard />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText(/Recent Registrations/i)).toBeInTheDocument(),
    );
  });

  it("shows the Import Schedule button when there are no climbs", async () => {
    getDocs.mockResolvedValue(makeQuerySnapshot([]));
    renderWithProviders(<Dashboard />, makeAdminAuth());
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: /Import 2026 Schedule/i }),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
});
