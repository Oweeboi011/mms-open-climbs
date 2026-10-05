import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { updateDoc } from "firebase/firestore";
import RegistrationPolicyInfo from "@/components/RegistrationPolicyInfo";
import CancelRegistrationModal from "@/components/CancelRegistrationModal";
import {
  canMemberCancel,
  formatDueDate,
  getCancellationPolicy,
  getPaymentDueDate,
  isPaymentOverdue,
  buildMemberCancelPatch,
} from "@/utils/registrationPolicy";

describe("registrationPolicy utils", () => {
  it("defaults the due date to 5 days before the climb starts", () => {
    expect(getPaymentDueDate({ startDate: "2026-10-10" })).toBe("2026-10-05");
    expect(getPaymentDueDate({ startDate: new Date(2026, 0, 3) })).toBe("2025-12-29");
    expect(getPaymentDueDate({ startDate: "2026-10-10", paymentDueDate: "2026-09-30" })).toBe("2026-09-30");
    expect(getPaymentDueDate({})).toBe("");
  });

  it("uses the club default policy unless the climb has its own", () => {
    expect(getCancellationPolicy({})).toMatch(/15 days or more/);
    expect(getCancellationPolicy({ cancellationPolicy: "  Own policy " })).toBe("Own policy");
  });

  it("is overdue against the default due date too", () => {
    const climb = { startDate: "2026-10-10" };
    expect(isPaymentOverdue(climb, 100, new Date(2026, 9, 6, 1))).toBe(true);
    expect(isPaymentOverdue(climb, 100, new Date(2026, 9, 5, 12))).toBe(false);
  });

  it("formats the stored YYYY-MM-DD due date", () => {
    expect(formatDueDate("2026-10-05")).toMatch(/Oct 5, 2026/);
    expect(formatDueDate("")).toBe("");
    expect(formatDueDate("next week")).toBe("");
  });

  it("is overdue only after the due day ends, and only while money is owed", () => {
    const climb = { paymentDueDate: "2026-10-05" };
    expect(isPaymentOverdue(climb, 500, new Date(2026, 9, 5, 22))).toBe(false);
    expect(isPaymentOverdue(climb, 500, new Date(2026, 9, 6, 1))).toBe(true);
    expect(isPaymentOverdue(climb, 0, new Date(2026, 9, 6, 1))).toBe(false);
    expect(isPaymentOverdue({}, 500, new Date(2026, 9, 6))).toBe(false);
  });

  it("lets members cancel live registrations until the climb is over", () => {
    const upcoming = { endDate: new Date("2099-01-01") };
    const past = { endDate: new Date("2020-01-01") };
    expect(canMemberCancel({ status: "pending" }, upcoming)).toBe(true);
    expect(canMemberCancel({ status: "waitlisted" }, upcoming)).toBe(true);
    expect(canMemberCancel({ status: "cancelled" }, upcoming)).toBe(false);
    expect(canMemberCancel({ status: "confirmed" }, past)).toBe(false);
  });

  it("builds only the fields the rules allow", () => {
    expect(Object.keys(buildMemberCancelPatch("TS")).sort()).toEqual(
      ["cancellationReason", "cancelledAt", "cancelledByMember", "status", "updatedAt"],
    );
  });
});

describe("RegistrationPolicyInfo", () => {
  it("falls back to the club defaults when the climb sets neither", () => {
    render(<RegistrationPolicyInfo climb={{ startDate: "2026-10-10" }} />);
    expect(screen.getByText(/Oct 5, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/15 days or more before the climb/)).toBeInTheDocument();
  });

  it("shows the due date and the policy text", () => {
    render(
      <RegistrationPolicyInfo
        climb={{ paymentDueDate: "2026-10-05", cancellationPolicy: "No refunds within 7 days." }}
      />,
    );
    expect(screen.getByText(/Oct 5, 2026/)).toBeInTheDocument();
    expect(screen.getByText("No refunds within 7 days.")).toBeInTheDocument();
  });
});

describe("CancelRegistrationModal", () => {
  it("shows the policy and cancels on confirmation", async () => {
    const onClose = vi.fn();
    render(
      <CancelRegistrationModal
        reg={{ id: "r1", climbId: "c1", climbTitle: "Pulag" }}
        climb={{ cancellationPolicy: "Permit fee is non-refundable." }}
        currentUser={{ uid: "u1" }}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Permit fee is non-refundable.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel registration" }));
    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.at(-1)[1];
    expect(patch.status).toBe("cancelled");
    expect(patch.cancelledByMember).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it("does nothing when the member keeps their place", () => {
    const onClose = vi.fn();
    updateDoc.mockClear();
    render(
      <CancelRegistrationModal
        reg={{ id: "r1", climbId: "c1", climbTitle: "Pulag" }}
        climb={{}}
        currentUser={{ uid: "u1" }}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Keep my registration/i }));
    expect(onClose).toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
  });
});
