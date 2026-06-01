/**
 * Tests for the Admin Climbs Manage page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import {
  renderWithProviders,
  makeAdminAuth,
  climbFixture,
} from "@/test/helpers";
import AdminClimbsManage from "@/pages/admin/ClimbsManage";
import { onSnapshot, updateDoc } from "firebase/firestore";
import { makeQuerySnapshot } from "@/test/setup";

const climbDoc = {
  id: climbFixture.id,
  data: { ...climbFixture, title: "Mt. Pulag" },
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
