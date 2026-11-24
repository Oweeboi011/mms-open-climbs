/**
 * Admins can add, change and remove the guests registered under a member's
 * account, and see what that does to the balance before saving.
 */
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import EditRegistrationModal from "@/components/EditRegistrationModal";
import { renderWithProviders, makeAdminAuth } from "@tests/helpers";

const climb = {
  title: "Mt. Pulag",
  startDate: "2027-03-20",
  fees: [{ label: "Registration Fee", amount: "500" }],
};
const reg = {
  id: "reg-1",
  name: "Juan Cruz",
  climbTitle: "Mt. Pulag",
  memberType: "member",
  feeBreakdown: [],
  guests: [],
};

function setup(overrides = {}) {
  const onSave = vi.fn(() => Promise.resolve());
  renderWithProviders(
    <EditRegistrationModal reg={reg} climb={climb} onClose={vi.fn()} onSave={onSave} {...overrides} />,
    makeAdminAuth(),
  );
  return { onSave };
}

describe("EditRegistrationModal — guests", () => {
  it("adds a guest, shows the balance change and saves it", async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole("button", { name: /add a guest/i }));
    fireEvent.change(screen.getByLabelText(/guest 1 name/i), { target: { value: "Mia" } });
    fireEvent.change(screen.getByLabelText(/age on the climb/i), { target: { value: "4" } });
    expect(screen.getByText(/more is owed now/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1].guests).toEqual([
      { name: "Mia", age: 4, relationship: "" },
    ]);
  });

  it("won't save a guest without an age", () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole("button", { name: /add a guest/i }));
    fireEvent.change(screen.getByLabelText(/guest 1 name/i), { target: { value: "Mia" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/enter their age/i)).toBeInTheDocument();
  });

  it("removes an existing guest", async () => {
    const guest = { name: "Leo", dateOfBirth: "2015-01-01", relationship: "Son" };
    const { onSave } = setup({ reg: { ...reg, guests: [guest] } });
    fireEvent.click(screen.getByRole("button", { name: /remove guest 1/i }));
    expect(screen.getByText(/less is owed now/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1].guests).toEqual([]);
  });
});
