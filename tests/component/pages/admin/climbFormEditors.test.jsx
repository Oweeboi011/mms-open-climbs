/**
 * Climb-form row editors must never put `undefined` into the form: Firestore
 * rejects the whole climb save over one undefined field. Older climbs carry
 * officers without `contact` and fees without `shareable`.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FeesEditor from "@/pages/admin/climbForm/FeesEditor";
import OfficersEditor from "@/pages/admin/climbForm/OfficersEditor";
import { EMPTY_FORM } from "@/pages/admin/climbForm/climbFormShared";

const listProps = () => ({
  addListItem: vi.fn(),
  moveListItem: vi.fn(),
  removeListItem: vi.fn(),
  updateListItem: vi.fn(),
});

const hasUndefined = (obj) => Object.values(obj).some((v) => v === undefined);

describe("climb form editors", () => {
  it("making an old fee optional sets shareable to false, not undefined", () => {
    const props = listProps();
    const form = { ...EMPTY_FORM, fees: [{ label: "Guide", amount: 500, note: "" }] };
    render(<FeesEditor form={form} {...props} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Optional/i }));
    const [, , fee] = props.updateListItem.mock.calls[0];
    expect(fee).toMatchObject({ optional: true, shareable: false });
    expect(hasUndefined(fee)).toBe(false);
  });

  it("linking an old officer to a member without a phone keeps contact a string", () => {
    const props = listProps();
    const form = { ...EMPTY_FORM, officers: [{ name: "Ana", role: "Team Leader" }] };
    const users = [{ uid: "u1", displayName: "Ana Reyes", email: "ana@x.com" }];
    const { container } = render(<OfficersEditor form={form} setForm={vi.fn()} users={users} {...props} />);
    const linkSelect = [...container.querySelectorAll("select")].find((s) => s.querySelector('option[value="u1"]'));
    fireEvent.change(linkSelect, { target: { value: "u1" } });
    const [, , officer] = props.updateListItem.mock.calls[0];
    expect(officer).toMatchObject({ userId: "u1", name: "Ana Reyes", contact: "" });
    expect(hasUndefined(officer)).toBe(false);
  });
});
