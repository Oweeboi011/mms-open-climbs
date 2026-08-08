/**
 * Tests for the Admin All Registrations page.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import {
  renderWithProviders,
  makeAdminAuth,
  registrationFixture,
  climbFixture,
  mockLiveSnapshot,
} from "@tests/helpers";
import AllRegistrations from "@/pages/admin/AllRegistrations";
import { getDocs, updateDoc } from "firebase/firestore";
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
    mockLiveSnapshot([regDoc, regDoc2]);
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

  it("sorts the climb filter dropdown by start date ascending", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: "climb-later",
          data: { title: "Later Climb", startDate: { toDate: () => new Date("2026-12-01") } },
        },
        {
          id: "climb-sooner",
          data: { title: "Sooner Climb", startDate: { toDate: () => new Date("2026-06-01") } },
        },
      ]),
    );

    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Sooner Climb/i })).toBeInTheDocument(),
    );

    const options = screen.getAllByRole("option").map((o) => o.textContent);
    const climbOptions = options.filter((t) => /Climb$/.test(t));
    expect(climbOptions).toEqual(["Sooner Climb", "Later Climb"]);
  });

  it("shows an optional-service toggle and updates it on click", async () => {
    mockLiveSnapshot([
          {
            id: registrationFixture.id,
            data: {
              ...registrationFixture,
              feeBreakdown: [
                { label: "Transportation Fee", amount: "300", optional: true, selected: false },
              ],
            },
          },
        ]);

    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Juan Cruz"));
    await waitFor(() => expect(
        screen.getByText("Not availing Transportation Fee"),
      ).toBeInTheDocument());

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
    mockLiveSnapshot([
          {
            id: registrationFixture.id,
            data: { ...registrationFixture, paymentStatus: "unpaid", amountPaid: null },
          },
        ]);

    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    // The dedicated "Outstanding" column was folded into "Payment"; the
    // amount due is now rendered inside that cell.
    await waitFor(() => expect(screen.getByText("Payment")).toBeInTheDocument());
    // Now rendered as "₱500 due" inside the Payment cell.
    expect(screen.getByText(/500 due/)).toBeInTheDocument();
  });

  it("shows the fee breakdown for a registrant when expanded", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([{ id: climbFixture.id, data: climbFixture }]),
    );
    mockLiveSnapshot([
          {
            id: registrationFixture.id,
            data: {
              ...registrationFixture,
              feeBreakdown: [
                { label: "Registration Fee", amount: "500", optional: false, selected: true },
              ],
            },
          },
        ]);

    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() =>
      expect(
        screen.getByText(/Fee Breakdown/),
      ).toBeInTheDocument(),
    );
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
    mockLiveSnapshot([regDoc]);

    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() =>
      expect(screen.getByText(/Med\. Cert Missing/i)).toBeInTheDocument(),
    );
  });

  it("filters to registrants missing required documents", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: climbFixture.id,
          data: { ...climbFixture, requiresMedicalCert: true },
        },
      ]),
    );
    mockLiveSnapshot([
          regDoc,
          {
            id: "reg-3",
            data: {
              ...registrationFixture,
              id: "reg-3",
              name: "Complete Docs Guy",
              medicalCertUpload: { url: "https://example.com/cert.pdf" },
            },
          },
        ]);

    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    await waitFor(() => {
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument();
      expect(screen.getByText("Complete Docs Guy")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Missing Required Docs", {
        selector: ".admin-stat-label",
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("All Documents"), {
      target: { value: "missing" },
    });

    await waitFor(() => {
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument();
      expect(screen.queryByText("Complete Docs Guy")).not.toBeInTheDocument();
    });
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

  it("lets an admin record a payment received in person", async () => {
    // This is the only admin page with a search box, so it's where an admin
    // looking for one person by name actually lands.
    renderWithProviders(<AllRegistrations />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Record Payment/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Record Payment/i }));

    await waitFor(() =>
      expect(
        document.querySelector('form input[type="number"]'),
      ).toBeInTheDocument(),
    );
    fireEvent.change(document.querySelector('form input[type="number"]'), {
      target: { value: "300" },
    });
    fireEvent.click(document.querySelector('form button[type="submit"]'));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.find((c) => c[1]?.payments)?.[1];
    expect(patch.payments[patch.payments.length - 1]).toMatchObject({
      amount: 300,
      status: "verified",
    });
  });
});
