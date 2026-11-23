/**
 * A member can change which optional services they owe for without
 * submitting a payment — only the fee selections are written.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import UpdateServicesButton from "@/components/UpdateServicesButton";
import { renderWithProviders, makeMemberAuth } from "@tests/helpers";

const climb = {
  id: "c1",
  title: "Mt. Pulag",
  fees: [
    { label: "Registration Fee", amount: "500" },
    { label: "Transportation", amount: "800", optional: true },
  ],
};

vi.mock("@/services/climbs", () => ({
  subscribeToClimb: vi.fn((id, onData) => {
    onData(climb);
    return () => {};
  }),
}));
const updateRegistration = vi.fn(() => Promise.resolve());
vi.mock("@/services/registrations", () => ({
  updateRegistration: (...args) => updateRegistration(...args),
}));

const reg = {
  id: "r1",
  climbId: "c1",
  climbTitle: "Mt. Pulag",
  memberType: "member",
  feeBreakdown: [{ label: "Transportation", amount: "800", optional: true, selected: false }],
};

describe("UpdateServicesButton", () => {
  beforeEach(() => updateRegistration.mockClear());

  it("adds a service and saves only the fee selections, with no payment", async () => {
    renderWithProviders(<UpdateServicesButton reg={reg} />, makeMemberAuth());
    fireEvent.click(screen.getByRole("button", { name: /update what i pay/i }));
    fireEvent.click(await screen.findByLabelText(/transportation/i));
    expect(screen.getAllByText(/₱1,300/)).toHaveLength(2); // total and balance (nothing paid yet)

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(updateRegistration).toHaveBeenCalled());
    const [id, patch] = updateRegistration.mock.calls[0];
    expect(id).toBe("r1");
    expect(Object.keys(patch).sort()).toEqual(["feeBreakdown", "updatedAt"]);
    expect(patch.feeBreakdown.find((f) => f.label === "Transportation").selected).toBe(true);
  });
});
