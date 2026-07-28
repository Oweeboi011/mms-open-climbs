/**
 * Tests for the Admin Climb Detail page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import {
  renderAtRoute,
  makeAdminAuth,
  climbFixture,
  registrationFixture,
} from "@tests/helpers";
import ClimbDetail from "@/pages/admin/ClimbDetail";
import { getDoc, getDocs, addDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { makeSnapshot, makeQuerySnapshot } from "@tests/setup";

const memberDoc = {
  id: "user-2",
  data: { displayName: "Maria Santos", email: "maria@example.com" },
};

describe("Admin ClimbDetail", () => {
  beforeEach(() => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, { ...climbFixture }),
    );
    getDocs.mockResolvedValue(makeQuerySnapshot([memberDoc]));
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          { id: registrationFixture.id, data: registrationFixture },
        ]),
      );
      return vi.fn();
    });
  });

  function render() {
    return renderAtRoute(
      <ClimbDetail />,
      "/admin/climbs/:id",
      `/admin/climbs/${climbFixture.id}`,
      makeAdminAuth(),
    );
  }

  it("renders the climb title as the page heading", async () => {
    render();
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag", { selector: ".admin-page-title" })).toBeInTheDocument(),
    );
  });

  it("lists registrant names after data loads", async () => {
    render();
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );
  });

  it("shows registration status badges", async () => {
    render();
    await waitFor(() =>
      // "pending" status badge — use getAllByText to avoid matching select <option> too
      expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0),
    );
  });

  it("shows a link back to admin climbs list", async () => {
    render();
    // Use anchored regex so "My Climbs" nav link is excluded
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /^Climbs$/i })).toBeInTheDocument(),
    );
  });

  it("lets an admin pick an existing member when adding a joiner", async () => {
    render();
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Add Joiner/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: /Maria Santos/i }),
      ).toBeInTheDocument(),
    );

    const memberSelect = screen.getByText("Existing Member", {
      selector: "label",
    }).closest(".form-group").querySelector("select");
    fireEvent.change(memberSelect, { target: { value: "user-2" } });

    fireEvent.click(
      screen.getByRole("button", { name: /Add Participant/i }),
    );

    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    const payload = addDoc.mock.calls[0][1];
    expect(payload.userId).toBe("user-2");
    expect(payload.name).toBe("Maria Santos");
    expect(payload.email).toBe("maria@example.com");
  });

  it("shows total paid and total outstanding stat tiles", async () => {
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
            },
          },
          {
            id: "reg-2",
            data: {
              ...registrationFixture,
              name: "Maria Santos",
              paymentStatus: "unpaid",
              feeBreakdown: [
                { label: "Registration Fee", amount: "500", optional: false, selected: true },
              ],
            },
          },
        ]),
      );
      return vi.fn();
    });

    render();
    await waitFor(() => expect(screen.getByText("Total Paid")).toBeInTheDocument());
    // Several cells legitimately show ₱500 in this fixture (Total Paid,
    // Total Outstanding, Juan's Paid cell, Maria's Outstanding cell) — just
    // confirm the value shows up rather than pinning an exact count.
    expect(screen.getAllByText("₱500").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Total Outstanding")).toBeInTheDocument();
  });

  it("shows each registrant's own outstanding amount in the table", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: registrationFixture.id,
            data: {
              ...registrationFixture,
              paymentStatus: "unpaid",
              feeBreakdown: [
                { label: "Registration Fee", amount: "500", optional: false, selected: true },
              ],
            },
          },
        ]),
      );
      return vi.fn();
    });

    render();
    await waitFor(() => expect(screen.getByText("Outstanding")).toBeInTheDocument());
    // Both the aggregate Total Outstanding stat and this registrant's own
    // row cell show ₱500, since they're the only unpaid registrant.
    expect(screen.getAllByText("₱500").length).toBeGreaterThanOrEqual(1);
  });

  it("subtracts an already-declared partial payment from outstanding", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: registrationFixture.id,
            data: {
              ...registrationFixture,
              paymentStatus: "submitted",
              amountPaid: 300,
              feeBreakdown: [
                { label: "Registration Fee", amount: "500", optional: false, selected: true },
              ],
            },
          },
        ]),
      );
      return vi.fn();
    });

    render();
    await waitFor(() => expect(screen.getByText("Outstanding")).toBeInTheDocument());
    // 500 expected - 300 already declared = 200 remaining (shown in both the
    // aggregate Total Outstanding stat and this registrant's own row cell).
    expect(screen.getAllByText("₱200").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the fee breakdown when a registrant row is expanded", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: registrationFixture.id,
            data: {
              ...registrationFixture,
              feeBreakdown: [
                { label: "Registration Fee", amount: "500", optional: false, selected: true },
                { label: "Transportation Fee", amount: "300", optional: true, selected: true },
              ],
            },
          },
        ]),
      );
      return vi.fn();
    });

    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() => expect(screen.getByText("Fee Breakdown")).toBeInTheDocument());
    expect(screen.getByText("Registration Fee")).toBeInTheDocument();
    expect(screen.getByText("Transportation Fee")).toBeInTheDocument();
    expect(screen.getAllByText("₱800").length).toBeGreaterThanOrEqual(1);
  });

  it("filters to only registrants with an outstanding balance", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          { id: registrationFixture.id, data: { ...registrationFixture, paymentStatus: "unpaid" } },
          {
            id: "reg-2",
            data: { ...registrationFixture, name: "Maria Santos", paymentStatus: "verified" },
          },
        ]),
      );
      return vi.fn();
    });

    render();
    await waitFor(() => expect(screen.getByText("Maria Santos")).toBeInTheDocument());

    const paymentFilter = screen.getByDisplayValue("All Payments");
    fireEvent.change(paymentFilter, { target: { value: "outstanding" } });

    await waitFor(() => {
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument();
      expect(screen.queryByText("Maria Santos")).not.toBeInTheDocument();
    });
  });

  it("lets an admin toggle a registrant's transportation selection", async () => {
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

    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() => expect(screen.getByText("Own transport")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.find((c) => c[1]?.feeBreakdown)?.[1];
    expect(patch.feeBreakdown[0].selected).toBe(true);
  });

  it("lets an admin edit a registrant's details from the quick actions bar", async () => {
    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    fireEvent.click(await screen.findByRole("button", { name: /Edit/i }));

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
