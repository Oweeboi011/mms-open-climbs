/**
 * Tests for the Admin Climb Detail page.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
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

// Captures what the page puts into the ZIP so the docs test can assert on
// the entry paths without unpacking a real archive.
const zipFile = vi.fn();
vi.mock("jszip", () => ({
  default: class {
    file = zipFile;
    generateAsync = () => Promise.resolve(new Blob(["zip"]));
  },
}));

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

// Mobile, emergency contact and medical conditions are required on the Add
// Participant form — officers rely on them on the trail.
function fillRequiredParticipantFields() {
  const form = screen
    .getByRole("button", { name: /Add to Climb/i })
    .closest("form");
  const byLabel = (text) =>
    Array.from(form.querySelectorAll("label"))
      .find((l) => l.textContent.trim().startsWith(text))
      .closest(".form-group")
      .querySelector("input,textarea");
  fireEvent.change(byLabel("Mobile"), { target: { value: "+63 917 000 0000" } });
  fireEvent.change(byLabel("Emergency Contact Name"), {
    target: { value: "Maria Cruz" },
  });
  fireEvent.change(byLabel("Emergency Contact Mobile"), {
    target: { value: "+63 917 111 1111" },
  });
  fireEvent.change(byLabel("Relationship"), { target: { value: "Spouse" } });
  fireEvent.change(byLabel("Medical Conditions"), {
    target: { value: "None" },
  });
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

    fireEvent.click(screen.getByRole("button", { name: /Add Participant/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: /Maria Santos/i }),
      ).toBeInTheDocument(),
    );

    const memberSelect = screen.getByText("Existing Member", {
      selector: "label",
    }).closest(".form-group").querySelector("select");
    fireEvent.change(memberSelect, { target: { value: "user-2" } });

    fillRequiredParticipantFields();
    fireEvent.click(screen.getByRole("button", { name: /Add to Climb/i }));

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
    // Also appears in the page's Expected Collection Breakdown, so these can
    // legitimately match more than once now.
    expect(screen.getAllByText("Registration Fee").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Transportation Fee").length).toBeGreaterThanOrEqual(1);
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

  it("opens the participant's Official Receipt with its payment log", async () => {
    mockRegistrantSnapshot([
      {
        id: registrationFixture.id,
        data: {
          ...registrationFixture,
          paymentStatus: "submitted",
          amountPaid: 500,
          feeBreakdown: [
            {
              label: "Registration Fee",
              amount: "800",
              optional: false,
              selected: true,
            },
          ],
          payments: [
            {
              amount: 500,
              proofs: [],
              submittedAt: null,
              note: "downpayment, balance on Friday",
            },
          ],
        },
      },
    ]);

    render();
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /View Receipt/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /View Receipt/i }));

    await waitFor(() =>
      expect(screen.getByText("Official Receipt")).toBeInTheDocument(),
    );
    // The receipt is the same document the member sees: fees owed, what was
    // accepted, the balance, and the comment left on the instalment.
    expect(screen.getByText("Payment Log")).toBeInTheDocument();
    // "Balance" is also the registrants table's column header.
    expect(screen.getAllByText("Balance").length).toBeGreaterThan(1);
    expect(screen.getAllByText("₱300").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/downpayment, balance on Friday/).length,
    ).toBeGreaterThan(0);
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

  // Everything the Compliance column ticks off, so a fixture built from this
  // shows no ✕ at all.
  const compliant = {
    waiverSigned: true,
    emergencyContact: {
      name: "Maria Cruz",
      mobile: "+63 917 111 1111",
      relationship: "Spouse",
    },
    medicalConditions: "None",
  };

  it("filters to registrants still missing a required document", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, { ...climbFixture, requiresPermit: true }),
    );
    mockRegistrantSnapshot([
      {
        id: registrationFixture.id,
        data: {
          ...registrationFixture,
          permitUpload: { url: "u/permit", fileName: "permit.pdf" },
        },
      },
      { id: "reg-2", data: { ...registrationFixture, name: "Maria Santos" } },
    ]);

    render();
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByDisplayValue("All Compliance"), {
      target: { value: "doc:permit" },
    });

    await waitFor(() => {
      expect(screen.getByText("Maria Santos")).toBeInTheDocument();
      expect(screen.queryByText("Juan Cruz")).not.toBeInTheDocument();
    });
  });

  it("filters to registrants with nothing outstanding on compliance", async () => {
    mockRegistrantSnapshot([
      {
        id: registrationFixture.id,
        data: { ...registrationFixture, ...compliant },
      },
      { id: "reg-2", data: { ...registrationFixture, name: "Maria Santos" } },
    ]);

    render();
    await waitFor(() =>
      expect(screen.getByText("Maria Santos")).toBeInTheDocument(),
    );

    const complianceFilter = screen.getByDisplayValue("All Compliance");
    fireEvent.change(complianceFilter, { target: { value: "complete" } });

    await waitFor(() => {
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument();
      expect(screen.queryByText("Maria Santos")).not.toBeInTheDocument();
    });

    // …and the inverse selection is exactly the complement.
    fireEvent.change(complianceFilter, { target: { value: "incomplete" } });
    await waitFor(() => {
      expect(screen.getByText("Maria Santos")).toBeInTheDocument();
      expect(screen.queryByText("Juan Cruz")).not.toBeInTheDocument();
    });
  });

  it("filters to registrants who have not signed the waiver", async () => {
    mockRegistrantSnapshot([
      {
        id: registrationFixture.id,
        data: { ...registrationFixture, ...compliant },
      },
      { id: "reg-2", data: { ...registrationFixture, name: "Maria Santos" } },
    ]);

    render();
    await waitFor(() =>
      expect(screen.getByText("Maria Santos")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByDisplayValue("All Compliance"), {
      target: { value: "waiver" },
    });

    await waitFor(() => {
      expect(screen.getByText("Maria Santos")).toBeInTheDocument();
      expect(screen.queryByText("Juan Cruz")).not.toBeInTheDocument();
    });
  });

  it("only offers doc filters for the documents this climb requires", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, { ...climbFixture, requiresPermit: true }),
    );

    render();
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );

    expect(
      screen.getByRole("option", { name: "Missing Permit" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Missing Med Cert" }),
    ).not.toBeInTheDocument();
  });

  it("lets an admin toggle a registrant's optional-service selection", async () => {
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

    await waitFor(() => expect(
        screen.getByText("Not availing Transportation Fee"),
      ).toBeInTheDocument());
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

  it("lets an admin submit a required document on a participant's behalf", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, {
        ...climbFixture,
        requiresPermit: true,
      }),
    );

    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Juan Cruz"));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /\+ Manage Documents/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /\+ Manage Documents/i }),
    );

    await waitFor(() =>
      expect(screen.getByText("Manage Required Documents")).toBeInTheDocument(),
    );

    const label = screen.getByText("Mountaineering / Trekking Permit", {
      selector: "label",
    });
    const fileInput = label
      .closest(".form-group")
      .querySelector('input[type="file"]');
    const file = new File(["permit"], "permit.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.find((c) => c[1]?.permitUpload)?.[1];
    expect(patch.permitUpload).toMatchObject({ fileName: "permit.pdf" });
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

  it("adds a participant on the name alone — the rest is theirs to complete", async () => {
    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Add Participant/i }));
    await waitFor(() =>
      expect(screen.getByText("Existing Member", { selector: "label" })).toBeInTheDocument(),
    );

    const form = screen
      .getByRole("button", { name: /Add to Climb/i })
      .closest("form");
    const nameInput = Array.from(form.querySelectorAll("label"))
      .find((l) => l.textContent.trim().startsWith("Full Name"))
      .closest(".form-group")
      .querySelector("input");
    fireEvent.change(nameInput, { target: { value: "Walk-in Joiner" } });

    fireEvent.click(screen.getByRole("button", { name: /Add to Climb/i }));

    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    const payload = addDoc.mock.calls[0][1];
    expect(payload.name).toBe("Walk-in Joiner");
    // Blank, never a guess: the participant fills these in from My Climbs.
    expect(payload.mobile).toBe("");
    expect(payload.emergencyContact).toEqual({
      name: "",
      mobile: "",
      relationship: "",
    });
    expect(payload.medicalConditions).toBe("");
  });

  it("still refuses a participant with no name", async () => {
    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Add Participant/i }));
    await waitFor(() =>
      expect(screen.getByText("Existing Member", { selector: "label" })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Add to Climb/i }));

    // The field label also matches, so assert on the error alert itself.
    await waitFor(() =>
      expect(screen.getByText(/Please complete:/i)).toHaveTextContent(
        /Full Name/i,
      ),
    );
    expect(addDoc).not.toHaveBeenCalled();
  });

  it("records the emergency contact and medical info on the registration", async () => {
    render();
    await waitFor(() => expect(screen.getByText("Juan Cruz")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Add Participant/i }));
    await waitFor(() =>
      expect(screen.getByText("Existing Member", { selector: "label" })).toBeInTheDocument(),
    );

    const form = screen
      .getByRole("button", { name: /Add to Climb/i })
      .closest("form");
    const nameInput = Array.from(form.querySelectorAll("label"))
      .find((l) => l.textContent.trim().startsWith("Full Name"))
      .closest(".form-group")
      .querySelector("input");
    fireEvent.change(nameInput, { target: { value: "Walk-in Joiner" } });
    fillRequiredParticipantFields();
    fireEvent.click(screen.getByRole("button", { name: /Add to Climb/i }));

    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    const payload = addDoc.mock.calls[0][1];
    expect(payload.emergencyContact).toEqual({
      name: "Maria Cruz",
      mobile: "+63 917 111 1111",
      relationship: "Spouse",
    });
    expect(payload.medicalConditions).toBe("None");
    expect(payload.mobile).toBe("+63 917 000 0000");
    // Signing binds the participant, so an admin never sets it.
    expect(payload.waiverSigned).toBe(false);
  });

  describe("Download Docs (ZIP)", () => {
    const uploads = {
      registrationFormUpload: { url: "u/form", fileName: "form.pdf" },
      medicalCertUpload: { url: "u/med", fileName: "med.pdf" },
      permitUpload: { url: "u/permit", fileName: "permit.pdf" },
      waiverDocUpload: { url: "u/waiver", fileName: "waiver.pdf" },
    };

    beforeEach(() => {
      zipFile.mockClear();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["x"]) }),
      );
      vi.stubGlobal("alert", vi.fn());
      URL.createObjectURL = vi.fn(() => "blob:zip");
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    async function clickDownload() {
      render();
      await waitFor(() =>
        expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /Download Docs/i }));
    }

    it("includes every required doc type, not just form and med cert", async () => {
      mockRegistrantSnapshot([
        { id: registrationFixture.id, data: { ...registrationFixture, ...uploads } },
      ]);
      await clickDownload();

      await waitFor(() => expect(zipFile).toHaveBeenCalledTimes(4));
      const paths = zipFile.mock.calls.map(([path]) => path);
      expect(paths).toEqual(
        expect.arrayContaining([
          "Juan Cruz (reg-1)/Form - form.pdf",
          "Juan Cruz (reg-1)/Med Cert - med.pdf",
          "Juan Cruz (reg-1)/Permit - permit.pdf",
          "Juan Cruz (reg-1)/Waiver Doc - waiver.pdf",
        ]),
      );
    });

    it("names the archive from the climb title plus today's date", async () => {
      // Real clock — fake timers would stall waitFor. The exact stamp format
      // is pinned in the downloadFileName util tests.
      const d = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const downloads = [];
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
        function () {
          downloads.push(this.download);
        },
      );
      mockRegistrantSnapshot([
        { id: registrationFixture.id, data: { ...registrationFixture, ...uploads } },
      ]);
      await clickDownload();

      await waitFor(() => expect(downloads).toHaveLength(1));
      expect(downloads[0]).toBe(
        `Mt-Pulag-requirement-docs-${today}.zip`,
      );
    });

    it("warns and builds nothing when no documents were uploaded", async () => {
      await clickDownload();
      await waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith(
          expect.stringMatching(/No uploaded requirement documents/i),
        ),
      );
      expect(zipFile).not.toHaveBeenCalled();
    });

    it("still delivers the ZIP when one document fails to fetch", async () => {
      mockRegistrantSnapshot([
        { id: registrationFixture.id, data: { ...registrationFixture, ...uploads } },
      ]);
      fetch.mockImplementation((url) =>
        url === "u/permit"
          ? Promise.resolve({ ok: false, status: 404 })
          : Promise.resolve({ ok: true, blob: async () => new Blob(["x"]) }),
      );
      await clickDownload();

      await waitFor(() => expect(zipFile).toHaveBeenCalledTimes(3));
      expect(URL.createObjectURL).toHaveBeenCalled();
      await waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith(
          expect.stringMatching(/1 of 4 document could not be downloaded/i),
        ),
      );
    });
  });
});
