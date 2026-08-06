/**
 * Tests for the Admin Climbs Manage page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import {
  renderWithProviders,
  makeAdminAuth,
  climbFixture,
} from "@tests/helpers";
import AdminClimbsManage from "@/pages/admin/ClimbsManage";
import { onSnapshot, updateDoc } from "firebase/firestore";
import { makeQuerySnapshot } from "@tests/setup";

const climbDoc = {
  id: climbFixture.id,
  data: {
    ...climbFixture,
    title: "Mt. Pulag",
    fees: [
      { label: "Registration Fee", amount: "500", optional: false },
      { label: "Guide Fee", amount: "700", optional: false },
      { label: "Transportation Fee", amount: "300", optional: true },
      { label: "Guest Fee", amount: "450", optional: true, isGuestFee: true },
    ],
  },
};
const climbDoc2 = {
  id: "climb-2",
  data: {
    ...climbFixture,
    id: "climb-2",
    title: "Mt. Apo",
    location: "Davao",
    status: "draft",
  },
};

describe("Admin ClimbsManage", () => {
  beforeEach(() => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([climbDoc, climbDoc2]));
      return vi.fn();
    });
  });

  it("renders the Climbs page heading", async () => {
    renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Climbs", { selector: ".admin-page-title" })).toBeInTheDocument(),
    );
  });

  it("lists climbs after data loads", async () => {
    renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
    await waitFor(() => {
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument();
      expect(screen.getByText("Mt. Apo")).toBeInTheDocument();
    });
  });

  it("filters climbs by search input", async () => {
    const { container } = renderWithProviders(
      <AdminClimbsManage />,
      makeAdminAuth(),
    );
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );

    const searchInput = container.querySelector("input");
    fireEvent.change(searchInput, { target: { value: "Apo" } });

    await waitFor(() => {
      expect(screen.queryByText("Mt. Pulag")).not.toBeInTheDocument();
      expect(screen.getByText("Mt. Apo")).toBeInTheDocument();
    });
  });

  it("renders a link to manage each climb", async () => {
    renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
    await waitFor(() =>
      expect(
        screen.getAllByRole("link", { name: /Manage|Details|Edit/i }).length,
      ).toBeGreaterThan(0),
    );
  });

  it("groups the table into upcoming and completed climbs", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: "climb-past",
            data: {
              ...climbFixture,
              id: "climb-past",
              title: "Mt. Past",
              startDate: { toDate: () => new Date("2020-01-01") },
            },
          },
          {
            id: "climb-future",
            data: {
              ...climbFixture,
              id: "climb-future",
              title: "Mt. Future",
              startDate: { toDate: () => new Date("2999-01-01") },
            },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Upcoming Climbs")).toBeInTheDocument(),
    );
    expect(screen.getByText("Completed Climbs")).toBeInTheDocument();

    // Group header rows bracket their climbs in document order.
    const rowText = [...document.querySelectorAll("tbody tr")].map(
      (tr) => tr.textContent,
    );
    const upcomingAt = rowText.findIndex((t) => t.includes("Upcoming Climbs"));
    const completedAt = rowText.findIndex((t) => t.includes("Completed Climbs"));
    const futureAt = rowText.findIndex((t) => t.includes("Mt. Future"));
    const pastAt = rowText.findIndex((t) => t.includes("Mt. Past"));
    expect(upcomingAt).toBeLessThan(futureAt);
    expect(futureAt).toBeLessThan(completedAt);
    expect(completedAt).toBeLessThan(pastAt);
  });

  it("shows the itemized fee breakdown when a climb row is expanded", async () => {
    renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getAllByLabelText("Expand details")[0]);

    await waitFor(() => {
      expect(screen.getByText("Registration Fee")).toBeInTheDocument();
      expect(screen.getByText("Transportation Fee")).toBeInTheDocument();
      expect(screen.getByText("Guest Fee")).toBeInTheDocument();
      // Required total — optional and guest fees are listed but not summed in.
      expect(screen.getByText("₱1,200")).toBeInTheDocument();
    });
  });

  it("summarizes fees on the row with optional and guest fees kept apart", async () => {
    renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getAllByLabelText("Expand details")[0]);

    await waitFor(() =>
      expect(
        screen.getByText("4 items — ₱1,200 required, +1 optional, +₱450 guest"),
      ).toBeInTheDocument(),
    );
  });

  it("calls updateDoc when a status is changed", async () => {
    renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "closed" } });
    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
  });
});
