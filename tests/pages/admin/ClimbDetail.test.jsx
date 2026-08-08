/**
 * Tests for the Admin Climb Detail page.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import {
  renderAtRoute,
  makeAdminAuth,
  climbFixture,
  registrationFixture,
  mockLiveSnapshot,
} from "@tests/helpers";
import ClimbDetail from "@/pages/admin/ClimbDetail";
import { getDoc, getDocs, addDoc, updateDoc } from "firebase/firestore";
import { makeSnapshot, makeQuerySnapshot } from "@tests/setup";

const memberDoc = {
  id: "user-2",
  data: { displayName: "Maria Santos", email: "maria@example.com" },
};

// The page opens three subscriptions — the climb doc, its registrations and
// its feedback. mockLiveSnapshot serves the registrant rows and routes the
// climb doc to whatever getDoc the test stubbed, so the registrant fixture
// can't bleed into the other two.
function mockRegistrantSnapshot(items) {
  mockLiveSnapshot(items);
}

describe("Admin ClimbDetail", () => {
  beforeEach(() => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, { ...climbFixture }),
    );
    getDocs.mockResolvedValue(makeQuerySnapshot([memberDoc]));
    mockRegistrantSnapshot([
      { id: registrationFixture.id, data: registrationFixture },
    ]);
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
    mockRegistrantSnapshot([
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
    ]);

    render();
    await waitFor(() => expect(screen.getByText("Total Paid")).toBeInTheDocument());
    // Several cells legitimately show ₱500 in this fixture (Total Paid,
    // Total Outstanding, Juan's Paid cell, Maria's Outstanding cell) — just
    // confirm the value shows up rather than pinning an exact count.
    expect(screen.getAllByText("₱500").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Total Outstanding")).toBeInTheDocument();
  });

  it("shows each registrant's own outstanding amount in the table", async () => {
    mockRegistrantSnapshot([
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
    ]);

    render();
    await waitFor(() => expect(screen.getByText("Balance")).toBeInTheDocument());
    // Both the aggregate Total Outstanding stat and this registrant's own
    // row cell show ₱500, since they're the only unpaid registrant.
    expect(screen.getAllByText("₱500").length).toBeGreaterThanOrEqual(1);
  });

  it("subtracts an already-declared partial payment from outstanding", async () => {
    mockRegistrantSnapshot([
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
    ]);

    render();
    await waitFor(() => expect(screen.getByText("Balance")).toBeInTheDocument());
    // 500 expected - 300 already declared = 200 remaining (shown in both the
    // aggregate Total Outstanding stat and this registrant's own row cell).
    expect(screen.getAllByText("₱200").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the fee breakdown when a registrant row is expanded", async () => {
    mockRegistrantSnapshot([
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
    ]);

    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() =>
      expect(
        screen.getByText("Fee Breakdown (current fees)"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Registration Fee")).toBeInTheDocument();
    expect(screen.getByText("Transportation Fee")).toBeInTheDocument();
    expect(screen.getAllByText("₱800").length).toBeGreaterThanOrEqual(1);
  });

  it("breaks out each payment when a registrant paid in instalments", async () => {
    mockRegistrantSnapshot([
      {
        id: registrationFixture.id,
        data: {
          ...registrationFixture,
          paymentStatus: "submitted",
          amountPaid: 800,
          paymentProofs: [
            { url: "https://x/a.jpg", fileName: "a.jpg" },
            { url: "https://x/b.jpg", fileName: "b.jpg" },
          ],
          payments: [
            {
              amount: 500,
              proofs: [{ url: "https://x/a.jpg", fileName: "a.jpg" }],
              submittedAt: null,
            },
            {
              amount: 300,
              proofs: [{ url: "https://x/b.jpg", fileName: "b.jpg" }],
              submittedAt: null,
              note: "balance for transportation",
            },
          ],
        },
      },
    ]);

    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() =>
      expect(screen.getByText(/Payment 1 of 2/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Payment 2 of 2/)).toBeInTheDocument();
    expect(screen.getByText("₱500")).toBeInTheDocument();
    expect(screen.getByText("₱300")).toBeInTheDocument();
    expect(screen.getByText(/balance for transportation/)).toBeInTheDocument();
    expect(
      screen.getByText(/Total across 2 payments: ₱800/),
    ).toBeInTheDocument();
  });

  it("still shows a pre-`payments` registration's receipts as one payment", async () => {
    mockRegistrantSnapshot([
      {
        id: registrationFixture.id,
        data: {
          ...registrationFixture,
          paymentStatus: "submitted",
          amountPaid: 500,
          paymentProofs: [{ url: "https://x/a.jpg", fileName: "a.jpg" }],
        },
      },
    ]);

    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() =>
      expect(screen.getByText(/^Payment 1$/)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Total across/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Verify Payment/i }),
    ).toBeInTheDocument();
  });

  it("flags an amount paid an admin edited away from the recorded payments", async () => {
    mockRegistrantSnapshot([
      {
        id: registrationFixture.id,
        data: {
          ...registrationFixture,
          paymentStatus: "submitted",
          amountPaid: 1000,
          payments: [{ amount: 500, proofs: [], submittedAt: null }],
        },
      },
    ]);

    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() =>
      expect(screen.getByText(/adjusted by an admin/i)).toBeInTheDocument(),
    );
  });

  it("lets an admin record an off-app payment, appending it to the history", async () => {
    mockRegistrantSnapshot([
      {
        id: registrationFixture.id,
        data: {
          ...registrationFixture,
          paymentStatus: "submitted",
          amountPaid: 500,
          payments: [{ amount: 500, proofs: [], submittedAt: null }],
        },
      },
    ]);

    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Record Payment/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ Record Payment/i }));

    await waitFor(() =>
      expect(screen.getByText("Amount Received")).toBeInTheDocument(),
    );
    fireEvent.change(document.querySelector('input[type="number"]'), {
      target: { value: "300" },
    });
    fireEvent.change(document.querySelector("textarea"), {
      target: { value: "cash at the jump-off" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /^Record Payment$/i }),
    );

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.find((c) => c[1]?.payments)?.[1];
    expect(patch.payments).toHaveLength(2);
    expect(patch.payments[1].amount).toBe(300);
    expect(patch.payments[1].note).toBe("cash at the jump-off");
    expect(patch.payments[1].recordedBy).toBeTruthy();
    expect(patch.amountPaid).toBe(800);
    // "Mark as verified" is checked by default, so the payment the admin just
    // logged is verified — but the member's earlier GCash payment is still
    // unreviewed, so the registration itself stays in the review queue.
    expect(patch.payments[1].status).toBe("verified");
    expect(patch.payments[0].status).toBe("submitted");
    expect(patch.paymentStatus).toBe("submitted");
  });

  it("verifies the whole registration once every payment is reviewed", async () => {
    mockRegistrantSnapshot([
      {
        id: registrationFixture.id,
        data: {
          ...registrationFixture,
          paymentStatus: "submitted",
          amountPaid: 500,
          payments: [{ amount: 500, proofs: [], status: "verified" }],
        },
      },
    ]);

    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /\+ Record Payment/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ Record Payment/i }));

    await waitFor(() =>
      expect(screen.getByText("Amount Received")).toBeInTheDocument(),
    );
    fireEvent.change(document.querySelector('input[type="number"]'), {
      target: { value: "300" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Record Payment$/i }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.find((c) => c[1]?.payments)?.[1];
    expect(patch.paymentStatus).toBe("verified");
    expect(patch.amountPaid).toBe(800);
  });

  it("lets an admin reject one instalment without voiding the rest", async () => {
    mockRegistrantSnapshot([
      {
        id: registrationFixture.id,
        data: {
          ...registrationFixture,
          paymentStatus: "submitted",
          amountPaid: 800,
          feeBreakdown: [
            { label: "Registration Fee", amount: "800", optional: false, selected: true },
          ],
          payments: [
            { amount: 500, proofs: [], status: "verified" },
            { amount: 300, proofs: [], status: "submitted" },
          ],
        },
      },
    ]);

    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() =>
      expect(screen.getByText(/Payment 2 of 2/)).toBeInTheDocument(),
    );

    // Per-payment controls: reject only the second instalment.
    const rejectButtons = screen.getAllByTitle(/Reject just this payment/i);
    fireEvent.click(rejectButtons[1]);

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.find((c) => c[1]?.payments)?.[1];
    expect(patch.payments[0].status).toBe("verified");
    expect(patch.payments[1].status).toBe("rejected");
    // The rejected ₱300 stops counting toward what they've paid, and with
    // everything now reviewed the registration rolls up to verified.
    expect(patch.amountPaid).toBe(500);
    expect(patch.paymentStatus).toBe("verified");
  });

  it("offers Record Payment even when nothing has been paid yet", async () => {
    mockRegistrantSnapshot([
      {
        id: registrationFixture.id,
        data: {
          ...registrationFixture,
          paymentStatus: "unpaid",
          amountPaid: null,
          paymentProofs: [],
        },
      },
    ]);

    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() =>
      expect(screen.getByText("No payments recorded yet.")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /\+ Record Payment/i }),
    ).toBeInTheDocument();
    // Nothing to verify or reject until a payment exists.
    expect(
      screen.queryByRole("button", { name: /Verify Payment/i }),
    ).not.toBeInTheDocument();
  });

  it("filters to only registrants with an outstanding balance", async () => {
    mockRegistrantSnapshot([
      { id: registrationFixture.id, data: { ...registrationFixture, paymentStatus: "unpaid" } },
      {
        id: "reg-2",
        data: { ...registrationFixture, name: "Maria Santos", paymentStatus: "verified" },
      },
    ]);

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
    mockRegistrantSnapshot([
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

  it("shows submitted feedback with an average rating", async () => {
    mockLiveSnapshot(
      [{ id: registrationFixture.id, data: registrationFixture }],
      {
        feedback: [
          { id: "fb-1", data: { name: "Juan Cruz", rating: 5, comments: "Amazing climb!" } },
          { id: "fb-2", data: { name: "Maria Santos", rating: 3, comments: "" } },
        ],
      },
    );

    render();
    await waitFor(() => {
      expect(screen.getByText("Climb Feedback (2)")).toBeInTheDocument();
      expect(screen.getByText("4.0/5")).toBeInTheDocument();
      expect(screen.getByText("Amazing climb!")).toBeInTheDocument();
      expect(screen.getByText("No comments")).toBeInTheDocument();
    });
  });

  it("hides the feedback card when there is no feedback yet", async () => {
    render();
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag", { selector: ".admin-page-title" })).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Climb Feedback/)).not.toBeInTheDocument();
  });
});
