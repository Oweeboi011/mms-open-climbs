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
} from "@tests/helpers";
import AllRegistrations from "@/pages/admin/AllRegistrations";
import { onSnapshot, getDocs, updateDoc } from "firebase/firestore";
import { makeQuerySnapshot } from "@tests/setup";

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

  it("shows a transportation toggle and updates it on click", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: registrationFixture.id,
            data: {
              ...registrationFixture,
              feeBreakdown: [
                { label: "Transportation Fee", amount: "300", optional: true, selected: false },
              ],
            },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Juan Cruz"));
    await waitFor(() => expect(screen.getByText("Own transport")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.find((c) => c[1]?.feeBreakdown)?.[1];
    expect(patch.feeBreakdown[0].selected).toBe(true);
  });

  it("shows each registrant's outstanding balance in the table", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: climbFixture.id,
          data: {
            ...climbFixture,
            fees: [{ label: "Registration Fee", amount: "500", optional: false }],
          },
        },
      ]),
    );
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: registrationFixture.id,
            data: { ...registrationFixture, paymentStatus: "unpaid", amountPaid: null },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Outstanding")).toBeInTheDocument());
    expect(screen.getByText("₱500")).toBeInTheDocument();
  });

  it("shows the fee breakdown for a registrant when expanded", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([{ id: climbFixture.id, data: climbFixture }]),
    );
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: registrationFixture.id,
            data: {
              ...registrationFixture,
              feeBreakdown: [
                { label: "Registration Fee", amount: "500", optional: false, selected: true },
              ],
            },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() => expect(screen.getByText("Fee Breakdown")).toBeInTheDocument());
    expect(screen.getByText("Registration Fee")).toBeInTheDocument();
  });

  it("shows missing required documents for the registrant's climb", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: climbFixture.id,
          data: { ...climbFixture, requiresMedicalCert: true },
        },
      ]),
    );
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([regDoc]));
      return vi.fn();
    });

    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() =>
      expect(screen.getByText(/Med\. Cert Missing/i)).toBeInTheDocument(),
    );
  });

  it("lets an admin edit a registrant's details", async () => {
    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: /^Edit$/i })[0]);

    await waitFor(() =>
      expect(screen.getByText("Edit Registration")).toBeInTheDocument(),
    );

    const nameInput = screen.getByDisplayValue("Juan Cruz");
    fireEvent.change(nameInput, { target: { value: "Juan Dela Cruz" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.find((c) => c[1]?.name)?.[1];
    expect(patch.name).toBe("Juan Dela Cruz");
  });
});
