/**
 * Tests for EditRegistrationModal — specifically correcting a participant
 * type that was set wrong at registration.
 *
 * The registration form defaults to "joiner", so a member who skipped the
 * radio is charged the guest fee. Until now `memberType` was displayed all
 * over the admin but editable nowhere, so there was no way to fix it.
 */
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import EditRegistrationModal from "@/components/EditRegistrationModal";
import { renderWithProviders, makeAdminAuth } from "@tests/helpers";

const climb = {
  title: "Mt. Pulag",
  fees: [
    { label: "Registration Fee", amount: "500", optional: false },
    { label: "Guest Fee", amount: "450", optional: true, isGuestFee: true },
  ],
};

const reg = {
  id: "reg-1",
  name: "Juan Cruz",
  climbTitle: "Mt. Pulag",
  memberType: "joiner",
  feeBreakdown: [],
};

function setup(overrides = {}) {
  const onSave = vi.fn(() => Promise.resolve());
  const onClose = vi.fn();
  const result = renderWithProviders(
    <EditRegistrationModal
      reg={reg}
      climb={climb}
      onClose={onClose}
      onSave={onSave}
      {...overrides}
    />,
    makeAdminAuth(),
  );
  return { ...result, onSave, onClose };
}

// Participant type is the modal's only <select>.
const typeSelect = () => screen.getByRole("combobox");

describe("EditRegistrationModal — participant type", () => {
  it("shows the registrant's current participant type", () => {
    setup();
    expect(typeSelect()).toHaveValue("joiner");
  });

  it("defaults a registration with no memberType to joiner, like the form does", () => {
    setup({ reg: { ...reg, memberType: undefined } });
    expect(typeSelect()).toHaveValue("joiner");
  });

  it("saves the corrected participant type", async () => {
    const { onSave } = setup();
    fireEvent.change(typeSelect(), { target: { value: "member" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toBe("reg-1");
    expect(onSave.mock.calls[0][1]).toMatchObject({ memberType: "member" });
  });

  it("warns what the correction does to the money before saving", () => {
    // Silently moving someone's balance is the thing to avoid here.
    setup();
    fireEvent.change(typeSelect(), { target: { value: "member" } });
    expect(screen.getByText(/₱950/)).toBeInTheDocument();
    expect(screen.getByText(/₱500/)).toBeInTheDocument();
    expect(
      screen.getByText(/guest fee no longer applies/i),
    ).toBeInTheDocument();
  });

  it("warns in the other direction too", () => {
    setup({ reg: { ...reg, memberType: "member" } });
    fireEvent.change(typeSelect(), { target: { value: "joiner" } });
    expect(screen.getByText(/guest fee now applies/i)).toBeInTheDocument();
  });

  it("shows no fee warning until the type actually changes", () => {
    const { container } = setup();
    expect(container.querySelector(".alert-warning")).toBeNull();
    expect(
      screen.queryByText(/Expected total changes/i),
    ).not.toBeInTheDocument();
  });

  it("still renders without a climb, just without the fee delta", () => {
    // AllRegistrations looks the climb up by id; it can legitimately be
    // missing if the climb was deleted.
    setup({ climb: undefined });
    fireEvent.change(typeSelect(), { target: { value: "member" } });
    expect(screen.queryByText(/Expected total changes/i)).not.toBeInTheDocument();
    expect(typeSelect()).toHaveValue("member");
  });
});
