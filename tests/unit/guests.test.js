import { describe, expect, it } from "vitest";
import { ageOn, getHeadcount, validateGuests } from "@/utils/guests";
import { computeExpectedTotal } from "@/utils/feeSummary";
import { getAvailmentCounts, getExpectedTotal, getFeeItems } from "@/utils/registrationFees";

const climb = {
  startDate: "2027-03-20",
  fees: [
    { label: "Registration", amount: "₱500" },
    { label: "Transportation", amount: "₱800", optional: true, guestFreeUpToAge: 4 },
    { label: "Guest Fee", amount: "₱200", optional: true, isGuestFee: true },
  ],
};
const kid = (name, dateOfBirth) => ({ name, dateOfBirth, relationship: "Child" });
const reg = (guests, transport = true) => ({
  id: "r1",
  memberType: "member",
  guests,
  feeBreakdown: [{ label: "Transportation", optional: true, selected: transport }],
});

describe("ageOn", () => {
  it("counts whole years on the date", () => {
    expect(ageOn("2023-03-21", "2027-03-20")).toBe(3);
    expect(ageOn("2023-03-20", "2027-03-20")).toBe(4);
  });
  it("rejects bad or future birthdates", () => {
    expect(ageOn("", "2027-03-20")).toBeNull();
    expect(ageOn("2030-01-01", "2027-03-20")).toBeNull();
  });
});

describe("guest fees", () => {
  it("exempts a 4-year-old from transport but not other fees", () => {
    const items = getFeeItems(reg([kid("Mia", "2023-03-20")]), climb);
    const mine = items.filter((i) => i.guestName === "Mia").map((i) => i.label);
    expect(mine).toEqual(["Registration", "Guest Fee"]);
  });
  it("charges a 5-year-old transport", () => {
    const items = getFeeItems(reg([kid("Leo", "2022-03-20")]), climb);
    expect(items.filter((i) => i.guestName === "Leo").map((i) => i.label)).toContain("Transportation");
  });
  it("follows the member's choice of optional services", () => {
    const items = getFeeItems(reg([kid("Leo", "2015-01-01")], false), climb);
    expect(items.some((i) => i.label === "Transportation")).toBe(false);
  });
  it("totals member plus guests", () => {
    // member 500 + 800; Leo 500 + 800 + 200; Mia 500 + 200
    const r = reg([kid("Leo", "2015-01-01"), kid("Mia", "2023-03-20")]);
    expect(getExpectedTotal(r, climb)).toBe(1300 + 1500 + 700);
  });
  it("matches the register form's live total", () => {
    const guests = [kid("Leo", "2015-01-01"), kid("Mia", "2023-03-20")];
    const live = computeExpectedTotal(climb, {
      isJoiner: false,
      optionalSelections: { Transportation: true },
      guests,
    });
    expect(live.total).toBe(getExpectedTotal(reg(guests), climb));
  });
  it("counts transport headcount by payers, not infants", () => {
    const r = reg([kid("Leo", "2015-01-01"), kid("Mia", "2023-03-20")]);
    const [transport] = getAvailmentCounts([r], climb);
    expect(transport.availing).toBe(2);
    expect(transport.total).toBe(3);
  });
});

describe("headcount and validation", () => {
  it("is the member plus guests", () => {
    expect(getHeadcount({})).toBe(1);
    expect(getHeadcount(reg([kid("A", "2020-01-01"), kid("B", "2020-01-01")]))).toBe(3);
  });
  it("requires a name and a real birthdate", () => {
    expect(validateGuests([{ name: "", dateOfBirth: "2020-01-01" }])).toMatch(/name/);
    expect(validateGuests([{ name: "A", dateOfBirth: "" }])).toMatch(/date of birth/);
    expect(validateGuests([kid("A", "2020-01-01")])).toBe("");
  });
});
