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
import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { getDocs, getDoc, updateDoc } from "firebase/firestore";
import MyRegistrations from "@/pages/MyRegistrations";
import {
  renderWithProviders,
  makeMemberAuth,
  registrationFixture,
  climbFixture,
  mockLiveSnapshot,
} from "@tests/helpers";
import { makeQuerySnapshot, makeSnapshot } from "@tests/setup";

describe("MyRegistrations page", () => {
  beforeEach(() => {
    // Officer climbs query
    getDocs.mockResolvedValue(makeQuerySnapshot([]));
    // Registrations listener — calls back immediately so loading resolves
    mockLiveSnapshot([]);
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
    mockLiveSnapshot([
          { id: registrationFixture.id, data: registrationFixture },
        ]);
    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );
  });

  it("shows Pending status label for pending registrations", async () => {
    mockLiveSnapshot([
          { id: registrationFixture.id, data: registrationFixture },
        ]);
    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText(/Pending/i)).toBeInTheDocument(),
    );
  });

  it("shows Confirmed label for confirmed registrations", async () => {
    mockLiveSnapshot([
          { id: "r2", data: { ...registrationFixture, status: "confirmed" } },
        ]);
    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText(/Confirmed/i)).toBeInTheDocument(),
    );
  });

  it("shows a Leave Feedback link for confirmed past climbs", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, {
        ...climbFixture,
        endDate: "2020-01-01",
      }),
    );
    mockLiveSnapshot([
          { id: registrationFixture.id, data: { ...registrationFixture, status: "confirmed" } },
        ]);
    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText("Leave Feedback")).toBeInTheDocument(),
    );
    expect(screen.getByText("Leave Feedback")).toHaveAttribute(
      "href",
      `/feedback/${climbFixture.id}`,
    );
  });

  it("does not show a Leave Feedback link for upcoming confirmed climbs", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, {
        ...climbFixture,
        endDate: "2099-01-01",
      }),
    );
    mockLiveSnapshot([
          { id: registrationFixture.id, data: { ...registrationFixture, status: "confirmed" } },
        ]);
    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Leave Feedback")).not.toBeInTheDocument();
  });

  it("updates the fee total when an optional fee is toggled in Submit Payment", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, {
        ...climbFixture,
        fees: [
          { label: "Registration Fee", amount: "500", optional: false },
          { label: "Transportation Fee", amount: "300", optional: true },
        ],
      }),
    );
    mockLiveSnapshot([
          {
            id: registrationFixture.id,
            data: { ...registrationFixture, paymentStatus: "unpaid" },
          },
        ]);

    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Submit Payment/i }));
    await waitFor(() =>
      expect(screen.getByText("Fee Breakdown")).toBeInTheDocument(),
    );
    expect(screen.getByText("₱500")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(screen.getByText("₱800")).toBeInTheDocument());
  });

  it("never offers the guest fee as a checkbox — members aren't charged it", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, {
        ...climbFixture,
        fees: [
          { label: "Registration Fee", amount: "500", optional: false },
          { label: "Guest Fee", amount: "450", optional: true, isGuestFee: true },
        ],
      }),
    );
    mockLiveSnapshot([
      {
        id: registrationFixture.id,
        data: {
          ...registrationFixture,
          memberType: "member",
          paymentStatus: "unpaid",
        },
      },
    ]);

    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Submit Payment/i }));

    await waitFor(() =>
      expect(screen.getByText("Fee Breakdown")).toBeInTheDocument(),
    );
    expect(screen.getByText("₱500")).toBeInTheDocument();
    expect(screen.queryByText("Guest Fee")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("charges a joiner the guest fee as a required line they can't untick", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, {
        ...climbFixture,
        fees: [
          { label: "Registration Fee", amount: "500", optional: false },
          { label: "Guest Fee", amount: "450", optional: true, isGuestFee: true },
        ],
      }),
    );
    mockLiveSnapshot([
      {
        id: registrationFixture.id,
        data: {
          ...registrationFixture,
          memberType: "joiner",
          paymentStatus: "unpaid",
        },
      },
    ]);

    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Submit Payment/i }));

    await waitFor(() =>
      expect(screen.getByText("Fee Breakdown")).toBeInTheDocument(),
    );
    expect(screen.getByText("Guest Fee")).toBeInTheDocument();
    expect(screen.getByText("₱950")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows a confirmation modal before submitting payment, and only writes after confirming", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, {
        ...climbFixture,
        fees: [{ label: "Registration Fee", amount: "500", optional: false }],
      }),
    );
    mockLiveSnapshot([
          {
            id: registrationFixture.id,
            data: { ...registrationFixture, paymentStatus: "unpaid" },
          },
        ]);

    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Submit Payment/i }));
    await waitFor(() =>
      expect(screen.getByText("Fee Breakdown")).toBeInTheDocument(),
    );

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(["receipt"], "receipt.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const amountInput = document.querySelector('input[type="number"]');
    fireEvent.change(amountInput, { target: { value: "500" } });

    fireEvent.click(screen.getByRole("button", { name: /^Submit$/i }));

    await waitFor(() =>
      expect(screen.getByText("Confirm Payment")).toBeInTheDocument(),
    );
    expect(updateDoc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Confirm & Submit/i }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.find((c) => c[1]?.paymentStatus)?.[1];
    expect(patch.paymentStatus).toBe("submitted");
  });

  it("lets a joiner add fees on an already-verified payment", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, {
        ...climbFixture,
        fees: [
          { label: "Registration Fee", amount: "500", optional: false },
          { label: "Transportation Fee", amount: "300", optional: true },
        ],
      }),
    );
    mockLiveSnapshot([
          {
            id: registrationFixture.id,
            data: {
              ...registrationFixture,
              paymentStatus: "verified",
              amountPaid: 500,
              verifiedAt: { toDate: () => new Date("2026-07-10") },
              verifiedBy: { name: "Admin User" },
              feeBreakdown: [
                { label: "Registration Fee", amount: "500", optional: false, selected: true },
                { label: "Transportation Fee", amount: "300", optional: true, selected: false },
              ],
              paymentProofs: [{ url: "https://x/gcash1.png", fileName: "gcash1.png" }],
            },
          },
        ]);

    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Add Fees \/ Pay More/i }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Add Fees \/ Pay More/i }));

    await waitFor(() =>
      expect(screen.getByText("Fee Breakdown")).toBeInTheDocument(),
    );
    expect(screen.getByText("₱500")).toBeInTheDocument();

    expect(screen.getByText(/Already Paid: ₱500/i)).toBeInTheDocument();
    expect(screen.getByText(/Verified: /i)).toBeInTheDocument();
    expect(screen.getByText("Previously submitted:")).toBeInTheDocument();
    expect(screen.getByText("gcash1.png")).toHaveAttribute(
      "href",
      "https://x/gcash1.png",
    );

    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(screen.getByText("₱800")).toBeInTheDocument());
  });

  it("adds a second payment to the history and the running total instead of replacing it", async () => {
    mockLiveSnapshot([
          {
            id: registrationFixture.id,
            data: {
              ...registrationFixture,
              paymentStatus: "verified",
              amountPaid: 500,
              paymentProofs: [{ url: "https://x/gcash1.png", fileName: "gcash1.png" }],
              payments: [
                {
                  amount: 500,
                  proofs: [{ url: "https://x/gcash1.png", fileName: "gcash1.png" }],
                  submittedAt: null,
                },
              ],
            },
          },
        ]);

    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Add Fees \/ Pay More/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Add Fees \/ Pay More/i }));

    await waitFor(() =>
      expect(screen.getByText("Amount of This Payment")).toBeInTheDocument(),
    );

    fireEvent.change(document.querySelector('input[type="file"]'), {
      target: { files: [new File(["r"], "gcash2.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.change(document.querySelector('input[type="number"]'), {
      target: { value: "300" },
    });
    fireEvent.change(document.querySelector("textarea"), {
      target: { value: "balance for transportation" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Submit$/i }));
    await waitFor(() =>
      expect(screen.getByText("Confirm Payment")).toBeInTheDocument(),
    );
    expect(screen.getByText(/bringing your recorded total to/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Confirm & Submit/i }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.find((c) => c[1]?.paymentStatus)?.[1];
    expect(patch.amountPaid).toBe(800);
    expect(patch.payments).toHaveLength(2);
    expect(patch.payments[1].amount).toBe(300);
    expect(patch.payments[1].note).toBe("balance for transportation");
    expect(patch.paymentProofs).toHaveLength(2);
  });

  it("shows the Official Receipt with fee breakdown and verification details", async () => {
    mockLiveSnapshot([
          {
            id: registrationFixture.id,
            data: {
              ...registrationFixture,
              paymentStatus: "verified",
              amountPaid: 500,
              feeBreakdown: [
                { label: "Registration Fee", amount: "500", optional: false, selected: true },
              ],
              verifiedBy: { name: "Admin User" },
              verifiedAt: { toDate: () => new Date("2026-07-15") },
              paymentSubmittedAt: { toDate: () => new Date("2026-07-10") },
            },
          },
        ]);

    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /View OR/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /View OR/i }));

    await waitFor(() =>
      expect(screen.getByText("Official Receipt")).toBeInTheDocument(),
    );
    expect(screen.getByText("Admin User")).toBeInTheDocument();
  });

  it("prices the Official Receipt off the climb's current fees, not the frozen snapshot", async () => {
    // Registered when the fee was ₱500; an officer has since corrected the
    // climb's schedule to ₱750 — the receipt must follow.
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, {
        ...climbFixture,
        fees: [{ label: "Registration Fee", amount: "750", optional: false }],
      }),
    );
    mockLiveSnapshot([
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
        ]);

    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /View OR/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /View OR/i }));

    await waitFor(() =>
      expect(screen.getByText("Official Receipt")).toBeInTheDocument(),
    );
    expect(screen.getByText("₱750")).toBeInTheDocument();
  });

  it("shows a Submit Registration Form button with a download link when required and not yet uploaded", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, {
        ...climbFixture,
        requiresRegistrationForm: true,
        registrationFormUrl: "https://example.com/form.pdf",
      }),
    );
    mockLiveSnapshot([
          {
            id: registrationFixture.id,
            data: { ...registrationFixture, paymentStatus: "verified" },
          },
        ]);

    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Submit Registration Form/i }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Submit Registration Form/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /Download Registration Form/i }),
      ).toBeInTheDocument(),
    );
  });

  it("shows a Submit Mountaineering / Trekking Permit button with a download link when required and not yet uploaded", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, {
        ...climbFixture,
        requiresPermit: true,
        permitSampleUrl: "https://example.com/permit.pdf",
      }),
    );
    mockLiveSnapshot([
          {
            id: registrationFixture.id,
            data: { ...registrationFixture, paymentStatus: "verified" },
          },
        ]);

    renderWithProviders(<MyRegistrations />, makeMemberAuth());
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /Submit Mountaineering \/ Trekking Permit/i,
        }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Submit Mountaineering \/ Trekking Permit/i,
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /View Sample Permit/i }),
      ).toBeInTheDocument(),
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
      expect(
        screen.getAllByText(/Assigned as Officer/i).length,
      ).toBeGreaterThan(0),
    );
  });

  describe("paying while an earlier payment is still awaiting review", () => {
    // Registration promises "you can pay in batches — go to My Climbs anytime
    // and submit another proof of payment". The pay button used to be gated
    // on paymentStatus unpaid/rejected/verified, so the moment a member
    // submitted a downpayment their status became "submitted" and every way
    // to pay the balance disappeared until an admin got round to verifying.
    function mockSubmitted() {
      getDoc.mockResolvedValue(
        makeSnapshot(climbFixture.id, {
          ...climbFixture,
          fees: [
            { label: "Registration Fee", amount: "500", optional: false },
            { label: "Transportation Fee", amount: "300", optional: true },
          ],
        }),
      );
      mockLiveSnapshot([
        {
          id: registrationFixture.id,
          data: {
            ...registrationFixture,
            paymentStatus: "submitted",
            amountPaid: 200,
            payments: [
              { amount: 200, proofs: [], status: "submitted" },
            ],
          },
        },
      ]);
    }

    it("still offers a way to pay the rest", async () => {
      mockSubmitted();
      renderWithProviders(<MyRegistrations />, makeMemberAuth());
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /Add Fees \/ Pay More/i }),
        ).toBeInTheDocument(),
      );
    });

    it("opens the pay prompt with the current fee schedule", async () => {
      mockSubmitted();
      renderWithProviders(<MyRegistrations />, makeMemberAuth());
      await waitFor(() =>
        screen.getByRole("button", { name: /Add Fees \/ Pay More/i }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: /Add Fees \/ Pay More/i }),
      );
      await waitFor(() =>
        expect(screen.getByText("Fee Breakdown")).toBeInTheDocument(),
      );
    });

    it("labels it Submit Payment when nothing is on record yet", async () => {
      getDoc.mockResolvedValue(makeSnapshot(climbFixture.id, climbFixture));
      mockLiveSnapshot([
        {
          id: registrationFixture.id,
          data: { ...registrationFixture, paymentStatus: "unpaid" },
        },
      ]);
      renderWithProviders(<MyRegistrations />, makeMemberAuth());
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /Submit Payment/i }),
        ).toBeInTheDocument(),
      );
      expect(
        screen.queryByRole("button", { name: /Add Fees \/ Pay More/i }),
      ).not.toBeInTheDocument();
    });

    it("offers nothing to pay on a cancelled registration", async () => {
      getDoc.mockResolvedValue(makeSnapshot(climbFixture.id, climbFixture));
      mockLiveSnapshot([
        {
          id: registrationFixture.id,
          data: {
            ...registrationFixture,
            status: "cancelled",
            paymentStatus: "submitted",
          },
        },
      ]);
      renderWithProviders(<MyRegistrations />, makeMemberAuth());
      await waitFor(() => screen.getByText("Mt. Pulag"));
      expect(
        screen.queryByRole("button", { name: /Add Fees \/ Pay More/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Submit Payment/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("signing a waiver added by an admin", () => {
    // An admin registering someone leaves waiverSigned false — a waiver binds
    // the person who signs it, so it can't be signed on their behalf. Before
    // this there was no way for them to finish it: no button, and
    // firestore.rules kept the waiver fields admin-only.
    function mockUnsigned(extra = {}) {
      getDoc.mockResolvedValue(makeSnapshot(climbFixture.id, climbFixture));
      mockLiveSnapshot([
        {
          id: registrationFixture.id,
          data: {
            ...registrationFixture,
            waiverSigned: false,
            waiverSignedName: null,
            addedByAdmin: true,
            ...extra,
          },
        },
      ]);
    }

    // The card button and the modal's submit share the "Sign Waiver" label;
    // the submit is the one inside the form.
    const submitSignature = () =>
      document.querySelector('form button[type="submit"]');

    it("tells the member their waiver is outstanding", async () => {
      mockUnsigned();
      renderWithProviders(<MyRegistrations />, makeMemberAuth());
      await waitFor(() =>
        expect(
          screen.getByText(/waiver isn.t signed yet/i),
        ).toBeInTheDocument(),
      );
    });

    it("offers Sign Waiver instead of Print Waiver", async () => {
      mockUnsigned();
      renderWithProviders(<MyRegistrations />, makeMemberAuth());
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /Sign Waiver/i }),
        ).toBeInTheDocument(),
      );
      expect(
        screen.queryByRole("link", { name: /Print Waiver/i }),
      ).not.toBeInTheDocument();
    });

    it("writes only the four fields the security rule permits", async () => {
      mockUnsigned();
      renderWithProviders(<MyRegistrations />, makeMemberAuth());
      await waitFor(() => screen.getByRole("button", { name: /Sign Waiver/i }));
      fireEvent.click(screen.getByRole("button", { name: /Sign Waiver/i }));

      await waitFor(() =>
        expect(screen.getByText(/Digital Signature/i)).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(submitSignature());

      await waitFor(() => expect(updateDoc).toHaveBeenCalled());
      const patch = updateDoc.mock.calls.find(
        (c) => c[1]?.waiverSigned !== undefined,
      )?.[1];
      expect(Object.keys(patch).sort()).toEqual([
        "updatedAt",
        "waiverSigned",
        "waiverSignedAt",
        "waiverSignedName",
      ]);
      expect(patch.waiverSigned).toBe(true);
      expect(patch.waiverSignedName).toBe("Juan Cruz");
    });

    it("refuses to sign without agreeing to the waiver", async () => {
      mockUnsigned();
      renderWithProviders(<MyRegistrations />, makeMemberAuth());
      await waitFor(() => screen.getByRole("button", { name: /Sign Waiver/i }));
      fireEvent.click(screen.getByRole("button", { name: /Sign Waiver/i }));
      await waitFor(() => screen.getByText(/Digital Signature/i));

      fireEvent.click(submitSignature());
      await waitFor(() =>
        expect(screen.getByText(/must agree to the waiver/i)).toBeInTheDocument(),
      );
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it("refuses a signature that is too short to be a name", async () => {
      mockUnsigned({ name: "Jo" });
      renderWithProviders(<MyRegistrations />, makeMemberAuth());
      await waitFor(() => screen.getByRole("button", { name: /Sign Waiver/i }));
      fireEvent.click(screen.getByRole("button", { name: /Sign Waiver/i }));
      await waitFor(() => screen.getByText(/Digital Signature/i));

      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(submitSignature());
      await waitFor(() =>
        expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument(),
      );
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it("shows Print Waiver, not Sign Waiver, once it is signed", async () => {
      getDoc.mockResolvedValue(makeSnapshot(climbFixture.id, climbFixture));
      mockLiveSnapshot([
        {
          id: registrationFixture.id,
          data: {
            ...registrationFixture,
            waiverSigned: true,
            waiverSignedName: "Juan Cruz",
          },
        },
      ]);
      renderWithProviders(<MyRegistrations />, makeMemberAuth());
      await waitFor(() =>
        expect(
          screen.getByRole("link", { name: /Print Waiver/i }),
        ).toBeInTheDocument(),
      );
      expect(
        screen.queryByRole("button", { name: /Sign Waiver/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("completing details an admin could only guess at", () => {
    function mockThin(extra = {}) {
      getDoc.mockResolvedValue(makeSnapshot(climbFixture.id, climbFixture));
      mockLiveSnapshot([
        {
          id: registrationFixture.id,
          data: {
            ...registrationFixture,
            mobile: "",
            emergencyContact: { name: "", mobile: "", relationship: "" },
            medicalConditions: "",
            addedByAdmin: true,
            ...extra,
          },
        },
      ]);
    }

    const saveDetails = () =>
      screen.getByRole("button", { name: /Save Details/i });

    it("flags that the record is incomplete", async () => {
      mockThin();
      renderWithProviders(<MyRegistrations />, makeMemberAuth());
      await waitFor(() =>
        expect(screen.getByText(/details are incomplete/i)).toBeInTheDocument(),
      );
      expect(
        screen.getByRole("button", { name: /Complete Your Details/i }),
      ).toBeInTheDocument();
    });

    it("writes only the fields the security rule permits", async () => {
      mockThin();
      renderWithProviders(<MyRegistrations />, makeMemberAuth());
      await waitFor(() =>
        screen.getByRole("button", { name: /Complete Your Details/i }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: /Complete Your Details/i }),
      );
      await waitFor(() => expect(saveDetails()).toBeInTheDocument());

      const form = saveDetails().closest("form");
      const [mobile, ecName, ecMobile, ecRel] =
        form.querySelectorAll("input");
      fireEvent.change(mobile, { target: { value: "+63 917 000 0000" } });
      fireEvent.change(ecName, { target: { value: "Maria Cruz" } });
      fireEvent.change(ecMobile, { target: { value: "+63 917 111 1111" } });
      fireEvent.change(ecRel, { target: { value: "Spouse" } });
      fireEvent.change(form.querySelector("textarea"), {
        target: { value: "None" },
      });
      fireEvent.click(saveDetails());

      await waitFor(() => expect(updateDoc).toHaveBeenCalled());
      const patch = updateDoc.mock.calls.find((c) => c[1]?.mobile)?.[1];
      expect(Object.keys(patch).sort()).toEqual([
        "emergencyContact",
        "medicalConditions",
        "mobile",
        "updatedAt",
      ]);
      expect(patch.emergencyContact).toEqual({
        name: "Maria Cruz",
        mobile: "+63 917 111 1111",
        relationship: "Spouse",
      });
    });

    it("will not save with medical conditions left blank", async () => {
      // Blank must never be ambiguous between "nothing to declare" and
      // "nobody asked" — "None" is the answer, not emptiness.
      mockThin({
        mobile: "+63 917 000 0000",
        emergencyContact: {
          name: "Maria Cruz",
          mobile: "+63 917 111 1111",
          relationship: "Spouse",
        },
      });
      renderWithProviders(<MyRegistrations />, makeMemberAuth());
      await waitFor(() =>
        screen.getByRole("button", { name: /Complete Your Details/i }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: /Complete Your Details/i }),
      );
      await waitFor(() => expect(saveDetails()).toBeInTheDocument());

      fireEvent.click(saveDetails());
      // The label and hint also say "medical conditions" — assert the alert.
      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          /medical conditions/i,
        ),
      );
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it("offers Update Details, not Complete, once the record is filled in", async () => {
      getDoc.mockResolvedValue(makeSnapshot(climbFixture.id, climbFixture));
      mockLiveSnapshot([
        {
          id: registrationFixture.id,
          data: {
            ...registrationFixture,
            mobile: "+63 917 000 0000",
            emergencyContact: {
              name: "Maria Cruz",
              mobile: "+63 917 111 1111",
              relationship: "Spouse",
            },
            medicalConditions: "None",
          },
        },
      ]);
      renderWithProviders(<MyRegistrations />, makeMemberAuth());
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /Update Details/i }),
        ).toBeInTheDocument(),
      );
      expect(
        screen.queryByText(/details are incomplete/i),
      ).not.toBeInTheDocument();
    });
  });
});
