/**
 * Tests for the Admin All Registrations page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import {
  renderWithProviders,
  makeAdminAuth,
  registrationFixture,
  climbFixture,
} from "@/test/helpers";
import AllRegistrations from "@/pages/admin/AllRegistrations";
import { onSnapshot, getDocs } from "firebase/firestore";
import { makeQuerySnapshot } from "@/test/setup";

const regDoc = { id: registrationFixture.id, data: { ...registrationFixture } };
const regDoc2 = {
  id: "reg-2",
  data: {
    ...registrationFixture,
    id: "reg-2",
    name: "Maria Santos",
    status: "confirmed",
  },
};
const climbDoc = { id: climbFixture.id, data: { ...climbFixture } };

describe("Admin AllRegistrations", () => {
  beforeEach(() => {
    getDocs.mockResolvedValue(makeQuerySnapshot([climbDoc]));
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([regDoc, regDoc2]));
      return vi.fn();
    });
  });

  it("renders the All Registrations heading", async () => {
    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("All Registrations", { selector: ".admin-page-title" })).toBeInTheDocument(),
    );
  });

  it("lists registrant names after data loads", async () => {
    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    await waitFor(() => {
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument();
      expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    });
  });

  it("filters registrations by search", async () => {
    const { container } = renderWithProviders(
      <AllRegistrations />,
      makeAdminAuth(),
    );
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );

    const searchInput = container.querySelector(
      'input[type="text"], input[type="search"]',
    );
    fireEvent.change(searchInput, { target: { value: "Maria" } });

    await waitFor(() => {
      expect(screen.queryByText("Juan Cruz")).not.toBeInTheDocument();
      expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    });
  });

  it("shows a climb filter dropdown", async () => {
    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0),
    );
  });
});
